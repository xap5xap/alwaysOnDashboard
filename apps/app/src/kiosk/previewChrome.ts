// The wall preview's platform-chrome seam -- WEB / DEFAULT no-op half (AOD-81; design-wall-viewport-contract
// §6, §10 row 7). WallPreview renders the AOD-39 presentation full-bleed for a brief ATTENDED peek; on web
// there are no OS bars and no hardware back, so both native behaviors are no-ops here. The native half
// (previewChrome.native.ts, Metro resolves the .native extension) (1) hides BOTH OS bars for the preview's
// lifetime so the peek is edge-to-edge like the immersive wall, restoring them on unmount, and (2) intercepts
// the hardware back to return to arranging. This seam carries ONLY those two chrome concerns, NOT the AOD-11
// runtime guard: the preview never takes keep-awake, pinning, a PIN, a CadenceProfile change, or the
// backlight (design §6). It is kept a distinct tiny seam (not folded into runtime.ts) precisely so WallPreview
// never pulls the native runtime's expo-brightness / expo-screen-orientation / expo-secure-store imports (nor
// react-native-web's unsupported BackHandler) — which keeps WallPreview loadable under jest-expo and clean on
// web.
export function useWallPreviewChrome(_onClose: () => void): void {
  // no-op on web; the native half runs setImmersiveMode(true)/back-intercept on mount, reversed on unmount.
}
