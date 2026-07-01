// The paywall per-trigger framing (design-onboarding-screens.md §7, AOD-12 §9). ONE paywall route leads with
// the matching upsell angle by its `trigger` param; only this LEAD line varies, the body (value props,
// packages, trial CTA, restore) is identical. Pure + exported so the map is unit-tested. `account` /
// onboarding / no-trigger lead with the trial itself (the per-trigger angle is for the in-app Gate locks).
export type PaywallTrigger = 'kiosk' | 'themes' | 'services' | 'dashboards' | 'refresh' | 'account';

const TRIAL_LEAD = 'Try everything free for 7 days.';

const LEADS: Record<PaywallTrigger, string> = {
  kiosk: 'Kiosk Mode turns this device into an always-on wall display.',
  themes: 'Make it yours. Themes are a Pro touch.',
  services: 'You are using both free services. Pro connects unlimited services.',
  dashboards: 'Free includes one dashboard. Pro adds as many as you like.',
  refresh: 'Free refreshes every 15 minutes. Pro goes live, down to per-widget rates.',
  account: TRIAL_LEAD,
};

/** The lead line for a trigger; unknown / absent triggers fall back to the 7-day-trial lead. */
export function leadForTrigger(trigger: string | undefined | null): string {
  if (trigger && trigger in LEADS) return LEADS[trigger as PaywallTrigger];
  return TRIAL_LEAD;
}

// The Pro value props: the AOD-12 §4 Entitlements levers as a checked list (design §6). One accent, no hype.
export const PRO_VALUE_PROPS: readonly string[] = [
  'Kiosk Mode',
  'Unlimited services',
  'More dashboards',
  'Faster, live refresh',
  'Themes',
];
