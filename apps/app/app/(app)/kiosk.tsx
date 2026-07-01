// The /kiosk route (app-ia.md §5 row 12): the kiosk wall. Pushed FULLSCREEN with gesture-back disabled
// (options set in (app)/_layout.tsx); the OS back intercept + the gesture+PIN exit lock are AOD-11's. Thin:
// delegates to the src/ placeholder; the wall presentation (landscape layout, dim curve, pinning) is
// AOD-39 / AOD-11. Accepts a `dashboardId` param (which layout to mount as the wall, AOD-11 KioskConfig).
export { KioskScreen as default } from '../../src/screens/placeholders';
