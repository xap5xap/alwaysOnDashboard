// The /dashboards route (app-ia.md §5 row 6): the create / switch dashboard switcher. Presented as a modal
// route (options set in (app)/_layout.tsx). Thin: delegates to the src/ switcher interior (AOD-27, built by
// AOD-69) -- the list + active-selection mark + the maxDashboards create gate.
export { DashboardsSwitcher as default } from '../../src/dashboard/DashboardsSwitcher';
