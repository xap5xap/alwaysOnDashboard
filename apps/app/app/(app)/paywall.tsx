// The /paywall route (app-ia.md §5 row 13): the upgrade / paywall. Presented as a modal route (options set
// in (app)/_layout.tsx); accepts a `trigger` param so the paywall leads with the matching upsell angle
// (AOD-12 §9). Thin: delegates to the src/ placeholder; the full paywall body is AOD-29.
export { PaywallScreen as default } from '../../src/screens/placeholders';
