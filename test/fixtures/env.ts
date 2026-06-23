// Test environment wiring (testing-strategy.md §8).
// The integration suite needs the local `supabase start` stack. scripts/test-integration.sh
// captures `supabase status` into these env vars before invoking `deno test`, so a green local
// run reproduces in CI with identical commands.

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `Missing env var ${name}. Run the suite via \`npm run test:integration\` (it exports ` +
        `the local Supabase connection from \`supabase status\`), not \`deno test\` directly.`,
    );
  }
  return value;
}

export const env = {
  /** PostgREST + Auth API base, e.g. http://127.0.0.1:54321 */
  SUPABASE_URL: required("SUPABASE_URL"),
  /** anon JWT: builds per-user clients that then sign in (the `authenticated` role). */
  SUPABASE_ANON_KEY: required("SUPABASE_ANON_KEY"),
  /** service-role JWT: the Auth admin API (create/delete users), bypasses RLS. */
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  /** Direct Postgres URL for the SQL harness (constraints + cascades), superuser. */
  SUPABASE_DB_URL: required("SUPABASE_DB_URL"),
} as const;
