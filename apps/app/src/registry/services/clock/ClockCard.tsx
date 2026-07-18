// The "Clock" leaf renderer (AOD-8 §6.1, integration-clock.md §4.1; RB-M2 AOD-130 Meridian). The bookend
// leaf: unlike every other card it receives NO live proxy data (the host none path hands it data: undefined,
// §6.3) and ignores it. It self-ticks from the device clock (useClockTick, §7.2) and formats via Intl
// (formatClock, §12) using the instance config. Reached only on the (always) Fresh state; the generic host
// draws the frame and the (suppressed at every size) header.
//
// AOD-130 MERIDIAN (subtractive reface): a single centered time FIGURE, no chrome at any size. The date line,
// the zone kicker, the GMT offset, and the wide-banner branch were all stripped, so the FitBody carries the
// VALUE ALONE (no lead, no detail) — the hero figure (hour:minute) width-fit into the box like before, plus
// two small SATELLITES beside it: the meridiem (AM/PM, 12h only) and the seconds WHISPER (small + muted +
// recessive, shown only when showSeconds). The satellites are sized as fractions of the fitted hero via the
// `meridian` token group, so the whole composite scales as one unit under the width-fit (never clips). The
// clockSize ramp is CONSUMED as the per-size baseSize, and the night recolor (useAmbient) + dimsWithAmbient:
// false opt-out are UNTOUCHED — the ~3h dusk->ember ramp is AOD-174 (RB-M6), not this issue; Meridian binds
// the ember to the CURRENT ambient phase (kiosk/ambient.ts owns the transition), it does not build one.
import React from 'react';
import { Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import { useAmbient } from '../../../ambient/AmbientContext';
import { FitBody } from '../../../widgets/FitBody';
import { tabularWidth } from '../../../widgets/fitLadder';
import { useClockTick } from './useClockTick';
import { formatClock, resolveConfig } from './time';

// The theme.clockSize ramp keys predate the S/M/W/L slot ids (AOD-122): bridge by geometry rather than
// rename the token group — S (1x1) -> the small step, W (2x1) -> the medium step (its geometric twin),
// L (2x2) -> the large step. M (1x2) is not a declared Clock size; if a coerced rect mounts it anyway it
// reads the medium step, exactly what the old unknown-size fallback did.
const CLOCK_RAMP_KEY: Record<WidgetSize, 'small' | 'medium' | 'large'> = {
  S: 'small',
  M: 'medium',
  W: 'medium',
  L: 'large',
};

export function ClockCard({ config, size, box }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const ambient = useAmbient();
  const clockConfig = resolveConfig(config);
  // The render tick: 1s when seconds are shown, else 60s (§7.2). `data` is intentionally ignored.
  const now = useClockTick(clockConfig.showSeconds);
  const view = formatClock(now, clockConfig);

  // §8.5 night palette (UNTOUCHED by AOD-130): the figure swaps to the deep-red ember at phase night, the
  // satellites recede a step (secondary/muted), and the whole card dims further with dimLevel (floor ~0.45).
  // Day = the standard palette; the meridiem + seconds whisper recede to textMuted. Bound to colour ROLES.
  const night = ambient.phase === 'night';
  const figureColor = night ? theme.night.primary : theme.colors.text;
  const meridiemColor = night ? theme.night.secondary : theme.colors.textMuted;
  const secondsColor = night ? theme.night.muted : theme.colors.textMuted;
  const nightOpacity = night ? Math.max(0.45, 1 - ambient.dimLevel * 0.6) : 1;

  // The satellite geometry (fractions of the fitted hero, so the composite scales as one). Present only when
  // there is something to show beside the figure (a 12h meridiem and/or the seconds whisper).
  const { meridiemScale, secondsScale, secondsOpacity, gapScale } = theme.meridian;
  const hasSatellite = view.meridiem != null || view.seconds != null;

  // §3.3 the composite is the scalable VALUE: its per-size clockSize step is the baseSize the FitBody
  // width-fit scales down from. The intrinsic width is the hero PLUS the gap + the widest satellite (both at
  // baseSize), so the fit reserves room for the meridiem/seconds and the composite never clips either axis.
  const baseSize = theme.clockSize[CLOCK_RAMP_KEY[size]];
  const satelliteWidth = Math.max(
    view.meridiem != null ? tabularWidth(view.meridiem, baseSize * meridiemScale) : 0,
    view.seconds != null ? tabularWidth(view.seconds, baseSize * secondsScale) : 0,
  );
  const intrinsicWidth = tabularWidth(view.figure, baseSize) + (hasSatellite ? baseSize * gapScale : 0) + satelliteWidth;

  const timeValue = {
    key: 'time',
    baseSize,
    intrinsicWidth,
    lineFactor: 1.1, // tabular time glyphs are compact; the satellites are smaller and add no height
    // The hero Text keeps a FLAT style object (its fontSize + color are read by the fit / night tests) and its
    // raw children (read by the tick test). The satellites ride beside it, sized off the same fitted fontSize.
    render: (fontSize: number) => (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={{
            fontSize,
            fontWeight: '700',
            letterSpacing: fontSize >= 80 ? -1 : -0.5,
            fontVariant: ['tabular-nums'],
            color: figureColor,
          }}
          numberOfLines={1}
          testID="clock-time"
        >
          {view.figure}
        </Text>
        {hasSatellite ? (
          <View style={{ marginLeft: fontSize * gapScale, justifyContent: 'center', alignItems: 'flex-start' }}>
            {view.meridiem != null ? (
              <Text
                style={{ fontSize: fontSize * meridiemScale, fontWeight: '700', letterSpacing: 0.5, color: meridiemColor }}
                numberOfLines={1}
                testID="clock-meridiem"
              >
                {view.meridiem}
              </Text>
            ) : null}
            {view.seconds != null ? (
              <Text
                style={{
                  fontSize: fontSize * secondsScale,
                  fontWeight: '600',
                  fontVariant: ['tabular-nums'],
                  color: secondsColor,
                  opacity: secondsOpacity, // the whisper recedes further than its muted colour
                }}
                numberOfLines={1}
                testID="clock-seconds"
              >
                {view.seconds}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    ),
  };

  // A chromeless, centered figure at EVERY size: no header reserved (headerShown false), the value centred as
  // a glance, no lead/detail. The night opacity rides the container.
  return (
    <FitBody
      size={size}
      box={box}
      headerShown={false}
      value={timeValue}
      glance
      style={{ opacity: nightOpacity }}
      testID="clock-card"
      accessibilityRole="summary"
    />
  );
}
