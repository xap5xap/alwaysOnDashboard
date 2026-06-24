// @vela/shared re-export of the canonical RevenueCat webhook schema + event mapping. The
// implementation lives under supabase/functions/_shared/revenuecat.ts (the Edge runtime only bundles
// files under supabase/functions/). The Expo app imports it as @vela/shared/revenuecat; the webhook
// Edge Function imports it directly as ../_shared/revenuecat.ts. See testing-strategy.md §3.2 / §11.
export * from "../../../supabase/functions/_shared/revenuecat.ts";
