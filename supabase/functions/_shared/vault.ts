// Vault access (AOD-9 §5.4, data-model.md §6): create/read/rotate/delete secrets through the
// privileged Postgres connection (db.ts). Rows hold only the returned Vault UUIDs; secret material
// never lives in a table. The atomic refresh path (refresh.ts) runs its Vault SQL inside the
// FOR UPDATE transaction directly, so these pool-based helpers serve the non-transactional callers
// (oauth-callback create, proxy read, disconnect delete).

import { db } from "./db.ts";

/** Create a secret, returning its Vault UUID. Name is left null (no uniqueness coupling). */
export async function createSecret(value: string, description?: string): Promise<string> {
  const sql = db();
  const [{ create_secret }] = await sql<{ create_secret: string }[]>`
    select vault.create_secret(${value}, null, ${description ?? null})
  `;
  return create_secret;
}

/** Read a decrypted secret by id, or null if it does not exist. */
export async function readSecret(id: string): Promise<string | null> {
  const sql = db();
  const rows = await sql<{ decrypted_secret: string }[]>`
    select decrypted_secret from vault.decrypted_secrets where id = ${id}
  `;
  return rows.length ? rows[0].decrypted_secret : null;
}

/** Rotate a secret in place (the Vault UUID on the connection row is unchanged). */
export async function updateSecret(id: string, value: string): Promise<void> {
  const sql = db();
  await sql`select vault.update_secret(${id}, ${value})`;
}

/** Hard-delete a secret (disconnect / account deletion, AOD-5). */
export async function deleteSecret(id: string): Promise<void> {
  const sql = db();
  await sql`delete from vault.secrets where id = ${id}`;
}
