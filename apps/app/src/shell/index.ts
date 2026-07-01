// The Vela app-navigation shell (design-core-navigation.md, AOD-68). The shared nav chrome the app-ia §9
// route tree mounts inside, one level up from the AOD-20 component library it COMPOSES (apps/app/src/ui/):
// the app frame, the two header patterns, the boot splash, the screen-level states, and the gate predicate
// the thin route files consume. The per-screen INTERIORS (AOD-27/28/29) fill this shell; they are not here.
export { AppBar } from './AppBar';
export type { AppBarProps } from './AppBar';
export { Screen, ScreenBody } from './Screen';
export { Splash } from './Splash';
export { LoadingState, EmptyState, ErrorState } from './ScreenState';
export { resolveGateTarget, GATE_HREF } from './gate';
export type { GateTarget, GateInput } from './gate';
export { useOnboarded } from './useOnboarded';
