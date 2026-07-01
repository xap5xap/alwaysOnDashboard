// The /onboarding route (app-ia.md §5 row 2): the first-run flow (AOD-29). Thin: delegates to the src/
// Onboarding screen (so the Unistyles babel plugin covers it). Reached from the gate when a signed-in user
// is not yet onboarded (useOnboarded seam, now backed by the persisted onboarded flag).
export { Onboarding as default } from '../../src/onboarding/Onboarding';
