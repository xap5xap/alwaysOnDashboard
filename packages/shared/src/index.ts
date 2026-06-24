// Shared module entry point, the Metro-facing @vela/shared specifier. The AOD-12 entitlement model
// and the RevenueCat webhook body / event mapping have their canonical source under
// supabase/functions/_shared/ (the Supabase Edge runtime only bundles files there); ./entitlements
// and ./revenuecat re-export it so the Expo app reads the identical source the Edge does. Note:
// Metro consumers must provide `zod` (a peer used by the revenuecat schema); Deno resolves it via
// the import map. The cross-runtime import is smoke-tested under deno (testing-strategy.md §3.2).
export type { Database, Json, Tables, TablesInsert, TablesUpdate } from "./database.types.ts";
export * from "./entitlements.ts";
export * from "./revenuecat.ts";
