// Vault helpers for the broker tests (testing-strategy.md §6: "Vault is NOT mocked"). These run
// over the direct superuser connection (db.ts) so a test can seed real secrets and assert the
// broker's writes/rotations/deletes by reading vault.decrypted_secrets back.

import { db } from "./db.ts";

/** Create a Vault secret, returning its UUID. */
export async function writeSecret(value: string, description = "aod test secret"): Promise<string> {
  const sql = db();
  const [{ create_secret }] = await sql<{ create_secret: string }[]>`
    select vault.create_secret(${value}, null, ${description})
  `;
  return create_secret;
}

/** Read a decrypted secret by id, or null if it no longer exists. */
export async function readSecret(id: string): Promise<string | null> {
  const sql = db();
  const rows = await sql<{ decrypted_secret: string }[]>`
    select decrypted_secret from vault.decrypted_secrets where id = ${id}
  `;
  return rows.length ? rows[0].decrypted_secret : null;
}

/** Whether a Vault secret row still exists (for asserting hard-delete on disconnect). */
export async function secretExists(id: string): Promise<boolean> {
  const sql = db();
  const rows = await sql`select 1 from vault.secrets where id = ${id}`;
  return rows.length > 0;
}
