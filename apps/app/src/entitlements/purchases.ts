// The RevenueCat purchase seam, native half (AOD-29 key decision: real RevenueCat wiring). Wraps the
// react-native-purchases SDK: configure + logIn(uid) (AOD-12 §5.3), getOfferings -> the monthly/annual
// packages, purchasePackage + restorePurchases, and the CustomerInfo update listener that flips the client
// locks off without a restart (AOD-12 §6.5). The server webhook (AOD-45) remains the line of trust; this is
// the client purchase path. The public SDK key comes from EXPO_PUBLIC_REVENUECAT_API_KEY; absent it (dev),
// configure is a no-op and the paywall renders the AOD-12 default packages (the store products + dashboard
// are a native/store follow-up). Metro resolves purchases.web.ts on web, so this SDK is never web-bundled.
import Purchases, { PACKAGE_TYPE, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { DEFAULT_PACKAGES, type PackageId, type PaywallPackage, type PurchasesApi } from './purchases.types';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
let configured = false;
// The live RevenueCat packages, keyed by our PackageId, so purchase(id) can call purchasePackage(pkg).
const packageById = new Map<PackageId, PurchasesPackage>();

function activeIds(info: CustomerInfo): string[] {
  return Object.keys(info.entitlements.active);
}

function packageIdOf(pkg: PurchasesPackage): PackageId | null {
  if (pkg.packageType === PACKAGE_TYPE.ANNUAL) return 'annual';
  if (pkg.packageType === PACKAGE_TYPE.MONTHLY) return 'monthly';
  return null;
}

export const purchases: PurchasesApi = {
  configure(userId) {
    if (!API_KEY) return; // no key in dev; the default packages still render, purchase is store-gated
    if (!configured) {
      Purchases.configure({ apiKey: API_KEY, appUserID: userId ?? undefined });
      configured = true;
    } else if (userId) {
      void Purchases.logIn(userId);
    }
  },

  isConfigured() {
    return configured;
  },

  async getPackages() {
    if (!configured) return DEFAULT_PACKAGES;
    try {
      const current = (await Purchases.getOfferings()).current;
      if (!current) return DEFAULT_PACKAGES;
      packageById.clear();
      const out: PaywallPackage[] = [];
      for (const pkg of current.availablePackages) {
        const id = packageIdOf(pkg);
        if (!id) continue;
        packageById.set(id, pkg);
        out.push({ id, priceString: pkg.product.priceString, period: id === 'annual' ? 'year' : 'month' });
      }
      out.sort((a, b) => (a.id === 'annual' ? -1 : 1)); // annual first (the design order)
      return out.length ? out : DEFAULT_PACKAGES;
    } catch {
      return DEFAULT_PACKAGES;
    }
  },

  async purchase(id) {
    const pkg = packageById.get(id);
    if (!pkg) throw new Error('Billing is not available yet. Try again once the store is configured.');
    const result = await Purchases.purchasePackage(pkg);
    return { activeEntitlementIds: activeIds(result.customerInfo) };
  },

  async restore() {
    const info = await Purchases.restorePurchases();
    return { activeEntitlementIds: activeIds(info) };
  },

  addListener(listener) {
    const wrapped = (info: CustomerInfo) => listener({ activeEntitlementIds: activeIds(info) });
    Purchases.addCustomerInfoUpdateListener(wrapped);
    return () => Purchases.removeCustomerInfoUpdateListener(wrapped);
  },
};
