// Direct Postgres connection for the SQL harness (testing-strategy.md §5.1).
// Constraint and cascade tests, and all row seeding, run over this superuser connection, which
// bypasses RLS and grants. The RLS POLICY tests, by contrast, go through per-user supabase-js
// clients (clients.ts) so they exercise the real PostgREST + policy path.
//
// `deno test` runs every test file in one process and flags leaked resources. So the pool is a
// lazy singleton that each test file closes in afterAll (via closeDb) and that re-creates on the
// next use. Pair closeDb() with `sanitizeResources: false` on the DB-backed describes.

import postgres from "postgres";
import { env } from "./env.ts";

type Sql = ReturnType<typeof postgres>;

let pool: Sql | null = null;

/** The lazily-created connection pool. Re-created after closeDb(). */
export function db(): Sql {
  if (!pool) {
    pool = postgres(env.SUPABASE_DB_URL, { prepare: false, ssl: false, max: 4 });
  }
  return pool;
}

/** Close the pool so the test process can exit; the next db() call re-creates it. */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end({ timeout: 5 });
    pool = null;
  }
}
