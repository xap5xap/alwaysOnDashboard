// DOGFOOD-ONLY entitlement grant (AOD-75). The dogfood Fire HD 8 runs Fire OS without Google Play
// services, so a store purchase can never flip Pro on it (real RevenueCat there is the AOD-77
// store-release path); internal builds grant Pro through this env override instead. It seeds ONLY
// the CustomerInfoProvider's INITIAL state: any real SDK CustomerInfo update (purchase / restore /
// listener) flows through the provider setter and overrides it. UX-only, like every client
// entitlement read; the server (AOD-45) stays the line of trust and never honors this.
//
// PRODUCTION GUARD: eas.json sets EXPO_PUBLIC_DEV_ENTITLEMENTS=pro in the `preview` profile only
// and pins it to "off" in `production` (the EAS schema rejects empty env strings; any value other
// than the exact "pro" refuses the grant). EXPO_PUBLIC_* inline at build time, so a store build
// compiles the grant away; the explicit pin also covers shell-env leakage in local
// `eas build --local` runs.
import { PRO_ENTITLEMENT_ID } from '@vela/shared';

/** The active-entitlement ids the dogfood grant seeds, or [] when the override is not set. */
export function devGrantedEntitlementIds(): string[] {
  return process.env.EXPO_PUBLIC_DEV_ENTITLEMENTS === 'pro' ? [PRO_ENTITLEMENT_ID] : [];
}
