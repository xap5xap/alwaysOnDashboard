// The paywall per-trigger framing (design-onboarding-screens.md §7, AOD-12 §9): the LEAD line varies by
// trigger while the body is identical. Proves the map + the fallback + the value-prop levers.
import { leadForTrigger, PRO_VALUE_PROPS } from '../triggerLeads';

describe('paywall per-trigger leads (§7)', () => {
  it('leads with the matching AOD-12 §9 angle per trigger', () => {
    expect(leadForTrigger('kiosk')).toMatch(/Kiosk Mode/);
    expect(leadForTrigger('themes')).toMatch(/Themes are a Pro touch/);
    expect(leadForTrigger('services')).toMatch(/unlimited services/);
    expect(leadForTrigger('dashboards')).toMatch(/one dashboard/);
    expect(leadForTrigger('refresh')).toMatch(/15 minutes/);
  });

  it('account / unknown / absent triggers lead with the 7-day trial itself', () => {
    expect(leadForTrigger('account')).toBe('Try everything free for 7 days.');
    expect(leadForTrigger(undefined)).toBe('Try everything free for 7 days.');
    expect(leadForTrigger('not-a-trigger')).toBe('Try everything free for 7 days.');
  });

  it('lists the AOD-12 §4 Pro levers as the value props', () => {
    expect(PRO_VALUE_PROPS).toEqual(
      expect.arrayContaining(['Kiosk Mode', 'Unlimited services', 'More dashboards', 'Faster, live refresh', 'Themes']),
    );
  });
});
