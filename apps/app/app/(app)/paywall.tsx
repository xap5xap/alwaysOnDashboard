// The /paywall route (app-ia.md §5 row 13): the upgrade / paywall (AOD-29). Presented as a transparentModal
// route (options in (app)/_layout.tsx) so the AOD-67 Sheet's scrim dims the caller; accepts a `trigger` param
// so it leads with the matching upsell angle (AOD-12 §9). Thin: delegates to the src/ Paywall screen.
export { Paywall as default } from '../../src/paywall/Paywall';
