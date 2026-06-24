// The single-flight refresh routine (AOD-9 §8.2-§8.4), shared by the token-refresh cron and the
// proxy's inline (lazy) refresh. Everything runs inside ONE transaction holding a FOR UPDATE lock
// on the connection row, and the Vault rotation + expires_at update commit together, so a rotating
// refresh token is never double-spent. Vault SQL runs on the transaction `tx` (not the pool
// helpers) precisely so it is atomic with the row update.

import { db } from "./db.ts";
import { getBackend } from "./registry.ts";
import { oauthClientCreds } from "./env.ts";
import { refreshAccessToken } from "./providers.ts";

export type RefreshOutcome = "refreshed" | "reauth_required" | "skipped";

interface ConnRow {
  id: string;
  service: string;
  auth_class: string;
  status: string;
  access_secret_id: string | null;
  refresh_secret_id: string | null;
  expires_at: string | Date | null;
}

/**
 * Refresh one connection if it is due (expires within `graceSeconds`). Re-checks due-ness AFTER
 * acquiring the lock, so a concurrent run that already renewed the token results in "skipped"
 * rather than a redundant second provider call.
 */
export async function refreshConnection(
  connectionId: string,
  opts: { graceSeconds: number },
): Promise<RefreshOutcome> {
  const sql = db();
  return await sql.begin(async (tx) => {
    const [conn] = await tx<ConnRow[]>`
      select id, service, auth_class, status, access_secret_id, refresh_secret_id, expires_at
      from public.connections
      where id = ${connectionId}
      for update
    `;
    if (!conn) return "skipped";
    if (conn.auth_class !== "oauth2" || !conn.refresh_secret_id || !conn.access_secret_id) return "skipped";

    // Single-flight re-check under the lock (AOD-9 §8.4).
    const dueBy = Date.now() + opts.graceSeconds * 1000;
    if (!conn.expires_at || new Date(conn.expires_at).getTime() > dueBy) return "skipped";

    const [secretRow] = await tx<{ decrypted_secret: string }[]>`
      select decrypted_secret from vault.decrypted_secrets where id = ${conn.refresh_secret_id}
    `;
    if (!secretRow) return "skipped";

    const backend = getBackend(conn.service);
    const creds = oauthClientCreds(conn.service);
    const result = await refreshAccessToken(backend, { refreshToken: secretRow.decrypted_secret, ...creds });

    if (!result.ok) {
      // invalid_grant: the refresh token is dead at the provider. Stop retrying (AOD-9 §8.2 step 4).
      await tx`update public.connections set status = 'reauth_required', updated_at = now() where id = ${conn.id}`;
      return "reauth_required";
    }

    const token = result.token;
    await tx`select vault.update_secret(${conn.access_secret_id}, ${token.access_token})`;
    if (token.refresh_token) {
      // Rotation: replace the refresh token in the same transaction (AOD-9 §8.2 step 3).
      await tx`select vault.update_secret(${conn.refresh_secret_id}, ${token.refresh_token})`;
    }
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;
    await tx`
      update public.connections
      set expires_at = ${expiresAt}, status = 'connected', updated_at = now()
      where id = ${conn.id}
    `;
    return "refreshed";
  });
}
