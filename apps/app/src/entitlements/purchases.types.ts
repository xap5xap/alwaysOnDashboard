// The RevenueCat purchase seam, shared shape (AOD-29 / AOD-12 §5). SDK-free, so both the native half
// (purchases.ts, real react-native-purchases) and the web half (purchases.web.ts, a verification fallback)
// implement it and the paywall + PurchasesBridge depend only on this. Metro platform resolution picks the
// half; tsc typechecks both. The activeEntitlementIds are the RevenueCat CustomerInfo.entitlements.active
// keys the AOD-12 tier math reads (a `pro` key => Pro).
import { PRO_ENTITLEMENT_ID } from '@vela/shared';

export type PackageId = 'monthly' | 'annual';

export interface PaywallPackage {
  id: PackageId;
  /** The localized store price (e.g. "$39.99"), or the AOD-12 default when no offering is configured. */
  priceString: string;
  period: 'month' | 'year';
}

export interface PurchasesResult {
  activeEntitlementIds: string[];
}

export interface PurchasesApi {
  /** Configure the SDK and identify the user (Purchases.logIn = app_user_id, AOD-12 §5.3). No-op without a key. */
  configure(userId: string | null): void;
  /** Whether a real RevenueCat key configured the SDK (false in dev / on web => the default packages render). */
  isConfigured(): boolean;
  getPackages(): Promise<PaywallPackage[]>;
  purchase(id: PackageId): Promise<PurchasesResult>;
  restore(): Promise<PurchasesResult>;
  /** Subscribe to CustomerInfo updates so a purchase flips the locks off without a restart (AOD-12 §6.5). */
  addListener(listener: (result: PurchasesResult) => void): () => void;
}

// AOD-12 §5.1 prices, annual first (the design order). The fallback shown when a RevenueCat offering is not
// yet configured (dev, web, or before the store products exist), so the paywall body always renders.
export const DEFAULT_PACKAGES: PaywallPackage[] = [
  { id: 'annual', priceString: '$39.99', period: 'year' },
  { id: 'monthly', priceString: '$5.99', period: 'month' },
];

export { PRO_ENTITLEMENT_ID };
