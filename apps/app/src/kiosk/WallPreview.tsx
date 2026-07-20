// The wall preview (AOD-81; design-wall-viewport-contract.md §6). The workbench answer to "let me check it at
// wall scale": while arranging, Preview mounts the TRUE AOD-39 wall render of the current DRAFT layout, and a
// tap anywhere (or OS back) returns to arranging. It is a PEEK, not a mode — no state survives it, and the
// draft layout is what renders (including uncommitted, optimistic gesture-end positions).
//
// Pixel-honest to the wall by REPLICATING the shipped KioskWall construction: the same near-black field with
// overflow hidden, the same auto-fit scale layer (transform scale = wallFitScale(layout, screen),
// transformOrigin left top), the same immersive full-bleed frame, the same current ambient phase. The scale
// is derived from the ONE viewport.wallFitScale helper the wall uses, so the preview shows exactly what the
// wall shows on this device.
//
// It DELIBERATELY skips the AOD-11 runtime guard (design §6): NO keep-awake, NO pinning, NO exit PIN, NO
// PinSetup, NO CadenceProfile change, NO backlight seize. It borrows only the immersive chrome, behind the
// previewChrome platform seam (web no-op / native hides the bars for the peek). A parallel slim component,
// as the design preferred over refactoring KioskWall. Owned + mounted in-screen by Dashboard (the same way it
// owns the picker / config sheets), never a router route: an RN Modal is a separate Android window that would
// re-show the OS bars over the immersive frame on Fire OS (the AOD-76 reason the PIN pad renders inline).
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { AmbientProvider } from '../ambient/AmbientContext';
import { LayoutCanvas } from '../layout/LayoutCanvas';
import type { WidgetInstance } from '../registry/types';
import { computeAmbient, DEFAULT_CURVE, DEFAULT_SCHEDULE } from './ambient';
import { layoutBounds, wallFitScale } from './viewport';
import { useWallPreviewChrome } from './previewChrome';

const noop = () => {};

export interface WallPreviewProps {
  /** The current DRAFT layout: the dashboard's live instances (incl. optimistic gesture-end positions). */
  instances: WidgetInstance[];
  /** Tap anywhere or OS back: return to arranging. */
  onClose(): void;
}

export function WallPreview({ instances, onClose }: WallPreviewProps) {
  const { theme, rt } = useUnistyles();
  const pad = theme.wall.padding;
  // The preview derives the SAME auto-fit scale + margin as the wall (viewport.wallFitScale against the
  // screen minus the wall padding), so it is pixel-honest: it shows exactly what the wall shows on this device.
  const available = { width: rt.screen.width - 2 * pad, height: rt.screen.height - 2 * pad };
  const scale = wallFitScale(layoutBounds(instances.map((i) => i.rect)), available);

  // §6 the two native-only chrome concerns, behind the platform seam (a web no-op): immersive full-bleed for
  // the peek (both OS bars hidden), and the hardware-back intercept that returns to arranging. Never the
  // AOD-11 runtime guard.
  useWallPreviewChrome(onClose);

  // §6 the CURRENT ambient phase, snapshotted once: a night peek shows the night wall (truth is the point).
  // A single pure computeAmbient — NOT the runtime's minute timer (a brief peek needs no driver, and this
  // takes no backlight). Controlled, so it renders the real phase rather than the __velaSetAmbient dev seam.
  const [ambient] = useState(() => computeAmbient(new Date(), DEFAULT_SCHEDULE, DEFAULT_CURVE));

  return (
    <View style={styles.field} testID="wall-preview">
      <AmbientProvider value={ambient}>
        {/* pointerEvents none, like the wall: the content is shown, not touched. The dismiss target is the
            transparent layer below, so a tap anywhere returns without the cards intercepting it. */}
        <View pointerEvents="none" style={[styles.content, { padding: pad }]}>
          <View
            style={[styles.scaleLayer, { transform: [{ scale }] }]}
            testID="wall-preview-scale-layer"
          >
            <LayoutCanvas
              instances={instances}
              arranging={false}
              onEnterArrange={noop}
              onExitArrange={noop}
              onCommit={noop}
              onRequestConfigure={noop}
              onRemove={noop}
            />
          </View>
        </View>
      </AmbientProvider>

      {/* §6 tap ANYWHERE returns to arranging (the whole surface is the dismiss target). No PIN is ever
          involved — this is an EDITOR surface for the owner mid-edit, not the kiosk's passer-by guard. */}
      <Pressable
        style={styles.dismiss}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close preview"
        testID="wall-preview-dismiss"
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  // The wall field, replicated: near-black, edge to edge, overflow hidden so the 1.4x layer is clipped to the
  // §3 window. Absolute-fill so Dashboard can mount it over the whole route container (above the shell chrome).
  field: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
    overflow: 'hidden',
  },
  content: { flex: 1 },
  scaleLayer: {
    flex: 1,
    transformOrigin: 'left top', // §3/§4 anchored at the top-left, exactly like KioskWall
  },
  dismiss: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
}));
