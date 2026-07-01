// The RevenueCat purchase seam, web half (the verification target). react-native-purchases has no web
// binding, so this fallback lets the paywall body render and the purchase/restore flow be exercised on Expo
// web without native billing: getPackages returns the AOD-12 default packages, and purchase() optimistically
// grants the `pro` entitlement for the session and notifies subscribers, so the PurchasesBridge flips the
// client Entitlements to PRO and the Gate locks fall away (AOD-12 §6.5) exactly as a real purchase would.
// Metro resolves this .web.ts in place of purchases.ts on web, so the SDK is never web-bundled. The real
// store purchase + webhook (AOD-45, already built) are the on-device path; this is UX-only, like the SDK read.
import { DEFAULT_PACKAGES, PRO_ENTITLEMENT_ID, type PurchasesApi, type PurchasesResult } from './purchases.types';

let purchased = false;
const listeners = new Set<(result: PurchasesResult) => void>();

function result(): PurchasesResult {
  return { activeEntitlementIds: purchased ? [PRO_ENTITLEMENT_ID] : [] };
}

function notify(): void {
  const r = result();
  listeners.forEach((listener) => listener(r));
}

export const purchases: PurchasesApi = {
  configure() {
    /* no native SDK on web */
  },
  isConfigured() {
    return true; // the fallback always has the default packages, so the CTA is live for verification
  },
  async getPackages() {
    return DEFAULT_PACKAGES;
  },
  async purchase() {
    purchased = true;
    notify();
    return result();
  },
  async restore() {
    return result();
  },
  addListener(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
