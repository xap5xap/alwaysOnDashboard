// The "Clock" leaf renderer (AOD-8 §6.1, integration-clock.md §4.1). The bookend leaf: unlike every other
// card it receives NO live proxy data (the host none path hands it data: undefined, §6.3) and ignores it.
// It self-ticks from the device clock (useClockTick, §7.2) and formats via Intl (formatClock, §12) using
// the instance config. Reached only on the (always) Fresh state; the generic host draws all other chrome.
// Functional and on-brand-enough; the digital/analog face, typography, the second-clock zone label, and
// the deep-red night palette are AOD-37. dimsWithAmbient is applied by the host overlay, not here.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import { useClockTick } from './useClockTick';
import { formatClock, resolveConfig } from './time';

export function ClockCard({ config }: WidgetRenderProps) {
  const clockConfig = resolveConfig(config);
  // The render tick: 1s when seconds are shown, else 60s (§7.2). `data` is intentionally ignored.
  const now = useClockTick(clockConfig.showSeconds);
  // Device locale (undefined); the zone comes from config or degrades to device-local (§7.3).
  const view = formatClock(now, clockConfig);

  return (
    <View style={styles.body} accessibilityRole="summary" testID="clock-card">
      <Text style={styles.time} numberOfLines={1} testID="clock-time">
        {view.time}
      </Text>
      {view.date != null ? (
        <Text style={styles.date} numberOfLines={1} testID="clock-date">
          {view.date}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(1) },
  time: { color: theme.colors.text, fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'] },
  date: { color: theme.colors.textMuted, fontSize: 15, fontWeight: '600' },
}));
