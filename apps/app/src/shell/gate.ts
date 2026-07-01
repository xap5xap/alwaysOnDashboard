// The auth gate predicate (app-ia.md §4.2, design-core-navigation.md §4). A PURE function that both the
// index gate (app/index.tsx) and the signed-in guard ((app)/_layout.tsx) consume, so the routing logic is
// unit-testable without rendering expo-router. It maps (loading, session, onboarded) to one of four
// targets; the thin route file turns the target into a <Splash/> or a <Redirect/> (§4.2 replace semantics,
// so the OS back never returns into a stale auth state).

export type GateTarget = 'splash' | 'sign-in' | 'onboarding' | 'app';

export interface GateInput {
  /** The AuthProvider `loading` flag: the Supabase session has not resolved yet. */
  loading: boolean;
  /** Whether a Supabase session exists (the user is signed in). */
  hasSession: boolean;
  /** Whether the signed-in user has completed first-run setup (the AOD-29 onboarding seam). */
  onboarded: boolean;
}

/** app-ia §4.2: loading -> splash; no session -> (auth); session + first-run -> onboarding; else -> (app). */
export function resolveGateTarget({ loading, hasSession, onboarded }: GateInput): GateTarget {
  if (loading) return 'splash';
  if (!hasSession) return 'sign-in';
  if (!onboarded) return 'onboarding';
  return 'app';
}

// The concrete href each non-splash target routes to (app-ia §4.5 route names), kept beside the predicate
// so the gate and the guard share one source of truth. The Dashboard home is `/dashboard`, not `/`,
// because the gate itself owns `/` (the expo-router index-collision reconciliation, app-ia §9 build note:
// `(app)` is a transparent group so `app/index.tsx` and `(app)/index.tsx` would both resolve to `/`).
export const GATE_HREF: Record<Exclude<GateTarget, 'splash'>, string> = {
  'sign-in': '/sign-in',
  onboarding: '/onboarding',
  app: '/dashboard',
};
