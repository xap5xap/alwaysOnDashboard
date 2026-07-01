// The /dashboard route: the app home / hub (app-ia.md §5 row 3). Thin: delegates to the src/ screen. The
// gate (app/index.tsx) redirects `/` here; the Dashboard cannot be the group index because the gate owns `/`.
export { Dashboard as default } from '../../src/dashboard/Dashboard';
