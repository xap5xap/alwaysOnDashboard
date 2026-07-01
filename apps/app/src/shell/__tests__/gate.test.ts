// The auth gate predicate (app-ia.md §4.2, design-core-navigation.md §4). The pure function both the index
// gate (app/index.tsx) and the signed-in guard ((app)/_layout.tsx) consume — tested here without rendering
// expo-router, so the four routing branches + the collision-reconciled home href are locked.
import { GATE_HREF, resolveGateTarget } from '../gate';

describe('resolveGateTarget (app-ia §4.2)', () => {
  it('loading -> splash, whatever the session/onboarded state', () => {
    expect(resolveGateTarget({ loading: true, hasSession: false, onboarded: false })).toBe('splash');
    expect(resolveGateTarget({ loading: true, hasSession: true, onboarded: true })).toBe('splash');
  });

  it('resolved + no session -> sign-in', () => {
    expect(resolveGateTarget({ loading: false, hasSession: false, onboarded: true })).toBe('sign-in');
  });

  it('resolved + session + not onboarded -> onboarding (first run)', () => {
    expect(resolveGateTarget({ loading: false, hasSession: true, onboarded: false })).toBe('onboarding');
  });

  it('resolved + session + onboarded -> app', () => {
    expect(resolveGateTarget({ loading: false, hasSession: true, onboarded: true })).toBe('app');
  });
});

describe('GATE_HREF (app-ia §4.5 route names + §9 reconciliation)', () => {
  it('maps each non-splash target to its route', () => {
    expect(GATE_HREF['sign-in']).toBe('/sign-in');
    expect(GATE_HREF.onboarding).toBe('/onboarding');
    // The home is /dashboard, NOT /, because the gate owns / (the expo-router index-collision fix).
    expect(GATE_HREF.app).toBe('/dashboard');
  });
});
