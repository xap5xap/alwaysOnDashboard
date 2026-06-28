// The "Daily Spend Sparkline" leaf renderer (AOD-8 §6.1, integration-claude.md §4.2). Reached only on
// data-bearing lifecycle states; the host draws every other state. Receives only { data, config, size }.
// The server maps each daily bucket to a DailyCost row (cents -> dollars / 100, oldest-first, §6.1); this
// card draws them as a simple proportional bar sparkline. An empty days[] is the normal "no spend yet
// this month" state, rendered flat, never a crash. Functional and on-brand-enough; the sparkline visual
// polish and the currency typography are a design follow-up (§10).
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { DailyCost, DailySpendData } from './types';

const SPARK_HEIGHT = 48; // px the tallest bar fills; the rest scale to the window max.

/** Defensive read: a partial payload renders as the empty card, never a crash (§4.2). */
function asDailySpend(data: unknown): DailySpendData {
  const d = (data ?? {}) as Partial<DailySpendData>;
  const days = Array.isArray(d.days) ? (d.days as DailyCost[]) : [];
  return {
    days,
    currency: typeof d.currency === 'string' && d.currency ? d.currency : 'USD',
    total: typeof d.total === 'number' ? d.total : 0,
  };
}

/** Major-unit money with the echoed currency: a $ symbol for USD, else a code suffix (§4.0a). */
function formatMoney(amount: number, currency: string): string {
  const fixed = amount.toFixed(2);
  return currency === 'USD' ? `$${fixed}` : `${fixed} ${currency}`;
}

export function DailySpendCard({ data }: WidgetRenderProps) {
  const { days, currency, total } = asDailySpend(data);

  if (days.length === 0) {
    return (
      <View style={styles.empty} accessibilityRole="summary">
        <Text style={styles.emptyText} testID="claude-daily-spend-empty">
          No spend yet this month
        </Text>
      </View>
    );
  }

  // Scale each bar to the window's max so the sparkline shows relative daily movement; a zero-spend month
  // (max 0) draws a flat baseline, the spec's "flat sparkline" state (§4.2), never a divide-by-zero.
  const max = days.reduce((m, d) => (d.amount > m ? d.amount : m), 0);

  return (
    <View style={styles.body} accessibilityRole="summary" testID="claude-daily-spend">
      <View style={styles.header}>
        <Text style={styles.label} numberOfLines={1}>
          Claude Daily Spend
        </Text>
        <Text style={styles.total} numberOfLines={1} testID="claude-daily-spend-total">
          {formatMoney(total, currency)}
        </Text>
      </View>
      <View style={styles.spark}>
        {days.map((d) => (
          <View
            key={d.date}
            style={[styles.bar, { height: max > 0 ? Math.max(2, (d.amount / max) * SPARK_HEIGHT) : 2 }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(1.5) },
  empty: { paddingVertical: theme.spacing(2) },
  emptyText: { color: theme.colors.textMuted, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing(2) },
  label: { color: theme.colors.accent, fontSize: 13, fontWeight: '600' },
  total: { color: theme.colors.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: SPARK_HEIGHT },
  bar: { flex: 1, backgroundColor: theme.colors.accent, borderRadius: 1, minWidth: 2 },
}));
