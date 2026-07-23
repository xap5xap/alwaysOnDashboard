// The device orientation hook (AOD-197, design §4/§6). The handheld surfaces read THIS to request + commit
// the orientation the user is holding, so per-orientation memory is functional: landscape and portrait are
// independently arranged and remembered (design §6.1). Reactive — it rides useWindowDimensions, so a device
// rotation re-renders the consumer with the new orientation and the surface re-resolves its layout.
//
// The wall never uses this: KioskWall calls useDashboard() with no args and stays landscape-locked
// (fit-to-bounds, byte-identical). This is a handheld concern only.
import { useWindowDimensions } from 'react-native';
import type { Orientation } from '../widgets/sizes';

/** The current device orientation from the window dimensions: landscape when width >= height (a square counts
 *  as landscape, the wall's orientation and the default everywhere), else portrait. Reactive on rotation. */
export function useOrientation(): Orientation {
  const { width, height } = useWindowDimensions();
  return width >= height ? 'landscape' : 'portrait';
}
