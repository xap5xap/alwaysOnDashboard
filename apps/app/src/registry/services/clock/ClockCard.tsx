// The "Clock" leaf renderer (AOD-8 §6.1, integration-clock.md §4.1, design-widget-system.md §8). The
// bookend leaf: unlike every other card it receives NO live proxy data (the host none path hands it
// data: undefined, §6.3) and ignores it. It self-ticks from the device clock (useClockTick, §7.2) and
// formats via Intl (formatClock, §12) using the instance config. Reached only on the (always) Fresh
// state; the generic host draws the frame, the SERVICE header (suppressed at S), and the dim chrome.
//
// AOD-37 §8 polish: the digital face across the S/W/L slots via the clockSize ramp, the date-line
// treatment per size, the second-clock zone kicker (only on a timezone override), and the deep-red night
// palette. The Clock is the canonical useAmbient() opt-in (dimsWithAmbient: false): by day it draws in the
// standard palette, by night (phase 'night') it recolours to night.* and dims further with dimLevel. None
// of this changes the { data, config, size } contract: useAmbient() is additive context and the leaf
// stays a pure function of (config, size, device clock).
//
// AOD-122: the §8.2 wide (3x1) banner branch is RETIRED with the 3-wide slot — no S/M/W/L slot has its
// geometry, and the Meridian face pass (M4) strips it anyway. W (2x1) renders the stack the old
// medium (2x1) rendered, so every surviving geometry keeps its pre-slot face.
import React from 'react';
import { Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import { useAmbient } from '../../../ambient/AmbientContext';
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

export function ClockCard({ config, size }: WidgetRenderProps) {
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

  // §3.3 the time scales with the size class (clockSize ramp), not a fixed type step. L -> 96 (display).
  const timeSize = theme.clockSize[CLOCK_RAMP_KEY[size]];
  const timeStyle: TextStyle = {
    fontSize: timeSize,
    fontWeight: '700',
    letterSpacing: timeSize >= 80 ? -1 : -0.5,
    fontVariant: ['tabular-nums'],
    color: timeColor,
  };

  const timeEl = (
    <Text style={timeStyle} numberOfLines={1} testID="clock-time">
      {view.time}
    </Text>
  );
  const kickerEl = showKicker ? (
    <Text style={[theme.type.caption, { color: kickerColor }]} numberOfLines={1} testID="clock-zone">
      {view.zoneLabel}
    </Text>
  ) : null;
  const dateEl = showDateLine ? (
    <Text style={[isLarge ? theme.type.heading : theme.type.meta, { color: dateColor }]} numberOfLines={1} testID="clock-date">
      {view.date}
    </Text>
  ) : null;

  // S / W / L: a centred (S) or left-aligned (W/L) vertical stack. The §8.2 wide 3x1 banner (and its
  // right-column zone-offset readout) is retired with the 3-wide slot (AOD-122).
  return (
    <View
      style={[isSmall ? styles.small : styles.stack, { opacity: nightOpacity }]}
      accessibilityRole="summary"
      testID="clock-card"
    >
      {kickerEl}
      {timeEl}
      {dateEl}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  small: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: {
    gap: theme.spacing(1),
  },
}));
