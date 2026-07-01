// The /kiosk route (app-ia.md §5 row 12): the kiosk wall. Pushed FULLSCREEN with gesture-back disabled
// (options set in (app)/_layout.tsx); the OS back intercept + the gesture+PIN exit lock are AOD-11's
// (wired behind the native runtime seam, a K-M1 follow-up). Thin: delegates to the src/ wall (AOD-72 builds
// the AOD-39 presentation). Accepts a `dashboardId` param (which layout to mount as the wall, AOD-11
// KioskConfig.layoutId; multi-dashboard selection is the app-ia §10 seam).
export { KioskWall as default } from '../../src/kiosk/KioskWall';
