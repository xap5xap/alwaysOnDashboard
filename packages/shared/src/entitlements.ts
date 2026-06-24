// @vela/shared re-export of the canonical AOD-12 entitlement model. The implementation lives under
// supabase/functions/_shared/entitlements.ts because the Supabase Edge runtime can only bundle files
// under supabase/functions/ (verified 2026-06-24). The Expo app (Metro) imports the same source
// through this re-export as @vela/shared/entitlements; the Edge functions import it directly as
// ../_shared/entitlements.ts. See testing-strategy.md §3.2 / §11 and AOD-25.
export * from "../../../supabase/functions/_shared/entitlements.ts";
