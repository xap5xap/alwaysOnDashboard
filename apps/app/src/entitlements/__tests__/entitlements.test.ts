// AOD-12 §4 / §5.2 entitlement pure-function units from @vela/shared under Metro (testing-strategy
// §4.1). Complements the cross-runtime smoke with the full matrix + the Infinity-limit guarantee.
import { entitlementsFor, FREE, PRO, PRO_ENTITLEMENT_ID, tierFromActiveEntitlements } from '@vela/shared';

describe('tierFromActiveEntitlements (AOD-12 §5.2)', () => {
  it('resolves Pro only when the pro entitlement is active', () => {
    expect(tierFromActiveEntitlements(new Set([PRO_ENTITLEMENT_ID]))).toBe('pro');
    expect(tierFromActiveEntitlements(new Set(['other']))).toBe('free');
    expect(tierFromActiveEntitlements(new Set<string>())).toBe('free');
  });
});

describe('entitlementsFor (AOD-12 §4)', () => {
  it('returns the AOD-3 matrices', () => {
    expect(entitlementsFor('free')).toEqual(FREE);
    expect(entitlementsFor('pro')).toEqual(PRO);
    expect(FREE.maxConnectedServices).toBe(2);
    expect(FREE.canUseKiosk).toBe(false);
    expect(PRO.canUseKiosk).toBe(true);
  });

  it('uses Infinity limits on Pro so a count check never blocks', () => {
    expect(PRO.maxConnectedServices).toBe(Number.POSITIVE_INFINITY);
    expect(PRO.maxDashboards).toBe(Number.POSITIVE_INFINITY);
    expect(5 >= PRO.maxConnectedServices).toBe(false);
  });
});
