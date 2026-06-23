// Shared module entry point. Spans the Expo app (Metro) and the Edge Functions (Deno).
// For now it only re-exports the generated database types. The shared Zod validation
// schemas (AOD-10/11/12 jsonb interiors + the RevenueCat webhook body) land in a later task.
export type { Database, Json, Tables, TablesInsert, TablesUpdate } from "./database.types.ts";
