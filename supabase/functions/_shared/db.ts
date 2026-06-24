// Pooled Postgres connection for the two things supabase-js cannot do (AOD-25): the refresh
// FOR UPDATE row lock (AOD-9 §8.4) and Vault SQL (the `vault` schema is not exposed through
// PostgREST). Ordinary table DML goes through supabase-js (supabase.ts). Lazy singleton so the
// module imports without connecting; closeDb() lets `deno test` exit cleanly.

import postgres from "postgres";
import { loadEnv } from "./env.ts";

export type Sql = ReturnType<typeof postgres>;

let pool: Sql | null = null;

export function db(): Sql {
  if (!pool) pool = postgres(loadEnv().dbUrl, { prepare: false, ssl: false, max: 4 });
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end({ timeout: 5 });
    pool = null;
  }
}
