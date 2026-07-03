// The arrange-mode wall boundary box (AOD-81; design-wall-viewport-contract.md §5). While arranging, the
// editor shows WHERE the kiosk wall's visible window ends: a quiet dashed frame drawn on the canvas from the
// origin, plus a device-computed "WALL · 11.4 x 7.1" tag at its inside bottom-right. It composes the AOD-27
// arrange surface additively (LayoutCanvas mounts it UNDER the cards) and takes NO touch (pointerEvents
// none): the box informs, it never polices — a card beyond it is valid dashboard space, so there is no error
// treatment (§5). Always-on in arrange for every dashboard on every device (decided; the per-dashboard "Use
// on wall" field is a named seam, §11).
//
// The window is the wall's LANDSCAPE steady state, NOT the editor's live insets (§5): the wall is
// landscape-locked and immersive (steady insets 0 on Android/Fire), so the box computes from the device
// screen normalized to landscape with WALL_STEADY_INSETS through the ONE wallViewportUnits helper the wall
// preview also derives from — box and preview show the identical window (§3). visibleUnits x UNIT_PX is the
// box in editor px (Fire HD 8: 914.3 x 571.4, the whole wall frame fits the landscape editor with room
// around it). The `arrange.wallGuide` role aliases are resolved HERE at the draw site, not in
// StyleSheet.create (the Unistyles babel plugin cannot trace a computed theme.colors[role]; the AOD-67 /
// PlacedInstance rule, [[aod-unistyles-style-token-gotcha]]). The dash is an SVG strokeDasharray because a
// View borderStyle cannot carry a 6/4 dash.
import React from 'react';
import { Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import Svg, { Rect } from 'react-native-svg';
import { UNIT_PX } from './geometry';
import { landscapeScreen, WALL_STEADY_INSETS, wallTagLabel, wallViewportUnits } from '../kiosk/viewport';

export function WallBoundaryBox() {
  const { theme, rt } = useUnistyles();
  const g = theme.arrange.wallGuide;
  const role = (name: string) => (theme.colors as Record<string, string>)[name];

  // §5 the WALL's landscape steady state: the device screen turned to landscape (long edge = width) with the
  // immersive steady insets (0 on Android/Fire), through the single §3 helper. Never rt.insets (the editor's
  // live insets, which are the app-chrome insets while arranging, not the wall's).
  const units = wallViewportUnits(landscapeScreen(rt.screen), WALL_STEADY_INSETS, theme.wall.typeScale);
  const boxW = units.w * UNIT_PX;
  const boxH = units.h * UNIT_PX;

  // No known screen (e.g. before layout on some hosts) -> nothing to draw. Keeps the box honest, never a 0-box.
  if (!(boxW > 0) || !(boxH > 0)) return null;

  const stroke = role(g.stroke);
  const inset = g.strokeWidth / 2; // so the 2px stroke is not clipped at the box edges

  return (
    // Anchored at the canvas origin (0,0), UNDER the cards, takes no part in gestures/hit-testing (§5).
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, width: boxW, height: boxH }}
      testID="wall-boundary-box"
    >
      <Svg width={boxW} height={boxH}>
        <Rect
          x={inset}
          y={inset}
          width={boxW - g.strokeWidth}
          height={boxH - g.strokeWidth}
          fill="none"
          stroke={stroke}
          strokeWidth={g.strokeWidth}
          strokeDasharray={`${g.dash[0]} ${g.dash[1]}`}
        />
      </Svg>

      {/* §5 the device-computed tag at the inside bottom-right: informational, not a control. surface fill,
          1px border, type.caption / textMuted. One decimal, in the same units the arrange gestures move cards. */}
      <View
        style={{
          position: 'absolute',
          right: theme.spacing(1.5),
          bottom: theme.spacing(1.5),
          backgroundColor: role(g.tagBg),
          borderWidth: 1,
          borderColor: role(g.tagBorder),
          borderRadius: theme.radius.sm,
          paddingHorizontal: theme.spacing(2),
          paddingVertical: theme.spacing(0.5),
        }}
        testID="wall-boundary-tag"
      >
        <Text style={{ ...theme.type.caption, color: role(g.tagText) }}>{wallTagLabel(units)}</Text>
      </View>
    </View>
  );
}
