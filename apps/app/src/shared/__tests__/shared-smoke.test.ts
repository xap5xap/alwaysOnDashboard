// Cross-runtime smoke: the Metro half of testing-strategy.md §3.2. This is the FIRST Metro/jest
// consumer of @vela/shared, whose canonical source lives under supabase/functions/_shared and is
// re-exported through packages/shared. Importing the index here pulls entitlements + revenuecat
// (and therefore zod) through the app's resolver, proving the module loads cleanly under Metro
// semantics and that the app provides zod (AOD-25 wiring risk). The deno half is the existing
// supabase cross-runtime smoke.
import {
  entitlementsFor,
  FREE,
  PRO,
  PRO_ENTITLEMENT_ID,
  tierFromActiveEntitlements,
  RevenueCatWebhookSchema,
} from '@vela/shared';

describe('@vela/shared under Metro/jest (testing-strategy §3.2)', () => {
  it('loads the entitlement model through the @vela/shared re-export', () => {
    expect(entitlementsFor('free')).toBe(FREE);
    expect(entitlementsFor('pro')).toBe(PRO);
  });

  it('resolves the tier from an active-entitlement set (AOD-12 §5.2)', () => {
    expect(tierFromActiveEntitlements(new Set([PRO_ENTITLEMENT_ID]))).toBe('pro');
    expect(tierFromActiveEntitlements(new Set<string>())).toBe('free');
  });

  it('pulls the zod-backed revenuecat schema (proves the app provides zod)', () => {
    const parsed = RevenueCatWebhookSchema.safeParse({
      event: { id: 'e1', type: 'INITIAL_PURCHASE', app_user_id: 'u1', event_timestamp_ms: 1 },
    });
    expect(parsed.success).toBe(true);
  });
});
