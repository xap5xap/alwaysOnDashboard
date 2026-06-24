// Zod request schemas for the broker functions (AOD-25: Zod is the one shared validation layer).
// These are server-side broker request shapes; the genuinely client-shared schemas (the proxy
// request, the RevenueCat webhook body) graduate to packages/shared when the app and webhook land
// (PS-M2 / the AOD-12 task). Kept here so both `deno test` and `functions serve` resolve them
// without reaching outside supabase/functions.

import { z } from "zod";

export const OauthStartSchema = z.object({
  service: z.string().min(1),
});
export type OauthStartBody = z.infer<typeof OauthStartSchema>;

export const CredentialsStoreSchema = z.object({
  service: z.string().min(1),
  // api_key / admin_key: the provider key. Mutually exclusive with `location` (platform_key).
  apiKey: z.string().min(1).optional(),
  // platform_key (Weather): the user-supplied location, stored as connection.config (AOD-9 §7.2).
  location: z.record(z.string(), z.unknown()).optional(),
  accountLabel: z.string().optional(),
});
export type CredentialsStoreBody = z.infer<typeof CredentialsStoreSchema>;

export const ProxySchema = z.object({
  service: z.string().min(1),
  widget: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type ProxyBody = z.infer<typeof ProxySchema>;

export const DisconnectSchema = z.object({
  connectionId: z.string().uuid(),
});
export type DisconnectBody = z.infer<typeof DisconnectSchema>;
