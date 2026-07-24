// AOD-211 (design-quick-actions-menu.md §6 / §9): the trackless footprint size picker — a NEW control, NOT
// a restyle of the AOD-148 Segmented (which stays for the config sheet's enum field + the Add gallery, §11).
// The size row in the long-press quick-actions menu shows one footprint GLYPH per supported size (the shape
// the widget becomes), the letter BELOW it (locked v2 `2a`, so size never rides on shape alone at low DPI).
// The glyphs are outline rounded-rects proportioned to the real S/M/W/L slots — S 1×1, M 1×2 tall, W 2×1
// WIDE (a wide rounded-rect, NOT a pill), L 2×2 — dropping the Segmented group track removes the
// surfaceAlt-on-surfaceAlt collision (§6). It is chrome: it spends no data hue; the one accent marks only the
// selected size. Geometry + role aliases come from the quickMenu.footprint token group (§10 row 2); this
// control resolves them to live theme colours at the draw site (the AOD-67 pattern). It names no service —
// the caller hands it the widget's supported sizes, already ordered.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';
import { roleColor, roleRadius } from '../ui';
import type { WidgetSize } from '../registry/types';

// The glyph box: the largest footprint (W 24 wide, L/M 22 tall) plus a 1px margin so the 1.5 stroke never
// clips at the box edge. Every size's rect is centred in this shared box, so the row's glyphs sit on one
// baseline and read as one shape family scaled (§6).
const GLYPH_BOX_W = 26;
const GLYPH_BOX_H = 24;

/** One footprint glyph: an outline rounded-rect sized to the size's real slot proportions, centred in the
 *  shared box so S/M/W/L line up. `tone` is the resolved outline colour (textMuted / accent / pressed). */
function FootprintGlyph({ size, tone }: { size: WidgetSize; tone: string }) {
  const { theme } = useUnistyles();
  const f = theme.quickMenu.footprint;
  const g = f.glyph[size];
  const x = (GLYPH_BOX_W - g.w) / 2;
  const y = (GLYPH_BOX_H - g.h) / 2;
  return (
    <Svg width={GLYPH_BOX_W} height={GLYPH_BOX_H} viewBox={`0 0 ${GLYPH_BOX_W} ${GLYPH_BOX_H}`} fill="none">
      <Rect x={x} y={y} width={g.w} height={g.h} rx={f.corner} stroke={tone} strokeWidth={f.stroke} />
    </Svg>
  );
}

export interface FootprintSizePickerProps {
  /** The widget's supported sizes, already in the canonical S→M→W→L order (a subset is fine — Clock is
   *  S/W/L, evenly spaced; §6). The caller only renders the picker when there is more than one. */
  options: WidgetSize[];
  /** The current size (the live instance's size, so a re-snap re-marks the row, AOD-195). */
  value: WidgetSize | undefined;
  /** Pick a size — the menu re-snaps immediately and STAYS OPEN (AOD-195), so the selection re-marks. */
  onChange?: (size: WidgetSize) => void;
  testID?: string;
}

export function FootprintSizePicker({ options, value, onChange, testID }: FootprintSizePickerProps) {
  const { theme } = useUnistyles();
  const f = theme.quickMenu.footprint;
  const selectedRadius = roleRadius(theme, f.selectedRadius);
  const unselected = roleColor(theme, f.strokeRole) ?? theme.colors.textMuted;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }} testID={testID}>
      {options.map((size) => {
        const selected = size === value;
        return (
          <Pressable
            key={size}
            onPress={() => onChange?.(size)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={testID ? `${testID}-${size}` : undefined}
            style={{ minWidth: f.cellTouch, minHeight: f.cellTouch, alignItems: 'center', justifyContent: 'center' }}
          >
            {({ pressed }) => {
              // §6: selected wears the accent (outline + letter over the accentMuted wash); pressing a
              // different cell LIFTS its ink (brightens toward `text`) and commits on release; otherwise the
              // resting textMuted. The wash + radius come from the token group.
              const tone = selected ? roleColor(theme, f.selectedOutline)! : pressed ? theme.colors.text : unselected;
              const letterColor = selected ? roleColor(theme, f.selectedLetter)! : pressed ? theme.colors.text : unselected;
              return (
                <View
                  style={[
                    { alignItems: 'center', gap: theme.spacing(1), paddingHorizontal: theme.spacing(1.5), paddingVertical: theme.spacing(1) },
                    selected && { backgroundColor: roleColor(theme, f.selectedFill), borderRadius: selectedRadius },
                  ]}
                >
                  <FootprintGlyph size={size} tone={tone} />
                  <Text style={{ ...theme.type[f.letter], color: letterColor }}>{size}</Text>
                </View>
              );
            }}
          </Pressable>
        );
      })}
    </View>
  );
}
