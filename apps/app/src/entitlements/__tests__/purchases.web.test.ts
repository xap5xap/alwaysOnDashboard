// The RevenueCat web fallback (AOD-29): the Expo-web verification path. Proves the paywall always has the
// AOD-12 default packages, and that purchase() grants `pro` + notifies subscribers (so the PurchasesBridge
// flips the Gate locks off) while restore() reflects the session state.
import { PRO_ENTITLEMENT_ID } from '@vela/shared';
import { purchases } from '../purchases.web';

describe('purchases web fallback (AOD-29 verification path)', () => {
  it('offers the AOD-12 default packages (annual first, $39.99 / $5.99)', async () => {
    const pkgs = await purchases.getPackages();
    expect(pkgs.map((p) => p.id)).toEqual(['annual', 'monthly']);
    expect(pkgs.find((p) => p.id === 'annual')?.priceString).toBe('$39.99');
    expect(pkgs.find((p) => p.id === 'monthly')?.priceString).toBe('$5.99');
  });

  it('purchase grants pro and notifies listeners; restore then reflects it', async () => {
    const seen: string[][] = [];
    const unsubscribe = purchases.addListener((r) => seen.push(r.activeEntitlementIds));

    const purchased = await purchases.purchase('annual');
    expect(purchased.activeEntitlementIds).toContain(PRO_ENTITLEMENT_ID);
    expect(seen.at(-1)).toContain(PRO_ENTITLEMENT_ID);

    const restored = await purchases.restore();
    expect(restored.activeEntitlementIds).toContain(PRO_ENTITLEMENT_ID);

    unsubscribe();
  });
});
