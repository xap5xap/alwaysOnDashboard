// The wall preview's immersive-chrome seam -- DEVICE half (AOD-81; design-wall-viewport-contract §6). Metro
// resolves this .native file on iOS / Android / Fire OS. It hides BOTH OS bars for the preview's lifetime
// (AOD-76's immersive toggle) so the brief peek is edge-to-edge like the real wall, then restores the shell
// chrome on unmount. It borrows ONLY the immersive helper, NOT the AOD-11 runtime guard: no keep-awake, no
// PIN, no PinSetup, no CadenceProfile, no backlight — the preview is attended by definition (design §6).
//
// Orientation lock is DELIBERATELY omitted (a build choice within the design's "borrows the orientation-lock
// helper is a build detail" latitude, §6): the dogfood wall device arranges in landscape, so the peek is
// already landscape; forcing a rotation on a brief preview is intrusive and risks an orientation-restore
// race, and the boundary box already encodes the landscape window regardless of the editor's orientation.
// Locking the preview to landscape is a named follow-up if a portrait-editor peek proves misleading.
//
// Also intercepts the hardware back to return to arranging (design §6): back must not pop the route out from
// under the editor. BackHandler is native-only (react-native-web logs an error for it), so it lives here, not
// in the shared WallPreview. Imports only react-native (BackHandler) + react-native-unistyles (UnistylesRuntime),
// both safe to load under jest-expo.
import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

export function useWallPreviewChrome(onClose: () => void): void {
  useEffect(() => {
    UnistylesRuntime.setImmersiveMode(true); // §6 immersive full-bleed for the peek (both OS bars hidden)
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose(); // §6 OS back returns to arranging
      return true; // consume it: never pop the route
    });
    return () => {
      back.remove();
      UnistylesRuntime.setImmersiveMode(false); // restore the shell chrome on dismiss
    };
  }, [onClose]);
}
