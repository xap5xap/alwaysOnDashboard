// The "Clock" leaf renderer (AOD-8 §6.1, integration-clock.md §4.1, design-widget-system.md §8). The
// bookend leaf: unlike every other card it receives NO live proxy data (the host none path hands it
// data: undefined, §6.3) and ignores it. It self-ticks from the device clock (useClockTick, §7.2) and
// formats via Intl (formatClock, §12) using the instance config. Reached only on the (always) Fresh
// state; the generic host draws the frame, the SERVICE header (suppressed at S), and the dim chrome.
//
// AOD-123 (attempt 2): the Clock is the SUBJECT of AOD-95/97 and the flagship of the shared fit-to-bounds
// body. AOD-95: at the small size the fixed 34px time "18:45" is ~96px in a 72px cell, so minutes clip.
// AOD-97: resizing to a tall/narrow cell scales the time to the HEIGHT so it overflows the WIDTH and
// hard-clips. The fix is the FitBody width-fit: the time is the scalable VALUE, rendered at its per-size
// clockSize step when it fits and otherwise scaled by min(widthScale, heightScale) in DP down to a floor,
// so it NEVER clips either axis. The zone kicker is the held LEAD; the date is truncate-then-drop DETAIL.
// Per-size CONTENT is unchanged (S: time only; W: time + date, + zone on a timezone override; L: the
// same with more room) — the fit is what changed, not the face. The clockSize ramp is CONSUMED as the
// per-size baseSize (not restructured), and the night recolor (useAmbient) + dimsWithAmbient:false opt-out
// are untouched. The Meridian styling pass (M4) still owns any aesthetic beyond the fit.
import React from 'react';
import { Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import { useAmbient } from '../../../ambient/AmbientContext';
import { FitBody, type FitLine } from '../../../widgets/FitBody';
import { tabularWidth } from '../../../widgets/fitLadder';
import { useClockTick } from './useClockTick';
import { formatClock, resolveConfig } from './time';

// The theme.clockSize ramp keys predate the S/M/W/L slot ids (AOD-122): bridge by geometry rather than
// rename the test-locked token group — S (1x1) -> the small step, W (2x1) -> the medium step (its
// geometric twin), L (2x2) -> the large step. M (1x2) is not a declared Clock size; if a coerced rect
// mounts it anyway it reads the medium step, exactly what the old unknown-size fallback did. The
// Meridian face (M4) owns retiring the legacy key names.
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
  // Device locale (undefined); the zone comes from config or degrades to device-local (§7.3).
  const view = formatClock(now, clockConfig);

  const isSmall = size === 'S';
  const isLarge = size === 'L';
  // §8.3 date hidden at S; §8.4 zone kicker shown only on a valid timezone override (second clock).
  const showDateLine = !isSmall && view.date != null;
  const showKicker = !isSmall && view.zoneLabel != null;

  // §8.5 night palette: deep red on the host's night frame, dimming further with dimLevel (floor ~0.45,
  // a build-refinement approximation of the §3.2 luminance multiply). Day = the standard palette.
  const night = ambient.phase === 'night';
  const timeColor = night ? theme.night.primary : theme.colors.text;
  const dateColor = night ? theme.night.secondary : theme.colors.textMuted;
  const kickerColor = night ? theme.night.muted : theme.colors.textMuted;
  const nightOpacity = night ? Math.max(0.45, 1 - ambient.dimLevel * 0.6) : 1;

  // §3.3 the time is the scalable VALUE: its per-size clockSize step is the baseSize the FitBody width-fit
  // scales down from when the string is too wide/tall for the box. tabularWidth estimates its DP width so
  // the fit needs no measurement. The Text keeps a FLAT style object (color read by the night test) and
  // its raw children (read by the tick test); only the fontSize now comes from the fit.
  const baseSize = theme.clockSize[CLOCK_RAMP_KEY[size]];
  const timeValue = {
    key: 'time',
    baseSize,
    intrinsicWidth: tabularWidth(view.time, baseSize),
    lineFactor: 1.1, // tabular time glyphs are compact
    render: (fontSize: number) => (
      <Text
        style={{
          fontSize,
          fontWeight: '700',
          letterSpacing: fontSize >= 80 ? -1 : -0.5,
          fontVariant: ['tabular-nums'],
          color: timeColor,
        }}
        numberOfLines={1}
        testID="clock-time"
      >
        {view.time}
      </Text>
    ),
  };

  // §8.4 the zone kicker rides ABOVE the time as the held lead (a second-clock label on an override).
  const lead: FitLine | undefined = showKicker
    ? {
        key: 'zone',
        role: 'caption',
        node: (
          <Text style={[theme.type.caption, { color: kickerColor }]} numberOfLines={1} testID="clock-zone">
            {view.zoneLabel}
          </Text>
        ),
      }
    : undefined;

  // §8.3 the date is truncate-then-drop detail (heading at L, meta elsewhere), so a cell too short simply
  // sheds it instead of clipping it below the card edge (the other half of the AOD-95 report).
  const detail: FitLine[] = showDateLine
    ? [
        {
          key: 'date',
          role: isLarge ? 'heading' : 'meta',
          node: (
            <Text style={[isLarge ? theme.type.heading : theme.type.meta, { color: dateColor }]} numberOfLines={1} testID="clock-date">
              {view.date}
            </Text>
          ),
        },
      ]
    : [];

  // S centres the time as a glance (header suppressed); W/L stack it with the date/zone.
  return (
    <FitBody
      size={size}
      box={box}
      headerShown={!isSmall}
      lead={lead}
      value={timeValue}
      detail={detail}
      gap={theme.spacing(1)}
      glance={isSmall}
      style={{ opacity: nightOpacity }}
      testID="clock-card"
      accessibilityRole="summary"
    />
  );
}
