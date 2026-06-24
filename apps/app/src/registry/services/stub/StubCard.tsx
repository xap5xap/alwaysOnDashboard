// The stub widget's leaf renderer (AOD-8 §6.1). It is reached only on data-bearing lifecycle states
// (fresh / stale / error-with-data); the generic host draws every other state's chrome. It receives
// only { data, config, size } and never branches on auth, loading, or errors. Styled with the
// Unistyles theme (AOD-16/AOD-25). This is a placeholder until real widgets land in PS-M3.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';

function summarize(data: unknown): string {
  if (data === null || data === undefined) return 'no data';
  if (typeof data === 'object') return JSON.stringify(data).slice(0, 120);
  return String(data);
}

export function StubCard({ data, size }: WidgetRenderProps) {
  return (
    <View style={styles.body} accessibilityRole="summary">
      <Text style={styles.label}>stub payload</Text>
      <Text style={styles.value}>{summarize(data)}</Text>
      <Text style={styles.meta}>size: {size}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing(1),
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
}));
