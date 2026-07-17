// The "Spend MTD" leaf renderer (AOD-8 §6.1, integration-claude.md §4.1, design-claude-usage.md §5).
// Reached only on data-bearing lifecycle states; the generic host draws every other state's chrome. It
// receives only { data, config, size } and never branches on auth, loading, or errors. A connected org
// with no spend yet is amount 0, a VALID figure rendered as the hero, not an empty state (§5.3). Currency
// is echoed from the payload, so the card formats without hard-coding $.
//
// AOD-36 polish: the value-first money body. The month-to-date total is the hero, drawn in the §5.1
// cents-precision money typography (MoneyValue: type.xl tabular dollars, a reduced raised $, reduced
// muted baseline-aligned cents). At W the run-rate is the emphasised derived figure below it: a
// type.meta line whose $/day VALUE is bright (colors.text) and whose label + day count recede
// (colors.textMuted); perDay = amount / daysElapsed, derived here with no extra request (§5.2). At S
// (the 1x1 glance) there is no room, so the body is just the amount, no run-rate (§5 layout). The leaf's
// old hand-drawn "Claude Spend (MTD)" label is gone: the host owns the quiet SERVICE · WIDGET caption (§4).
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { SpendMtdData } from './types';
import { MoneyValue, formatPlainMoney } from './MoneyValue';

/** Defensive read: a renderer must never crash on a partial payload (the host shows an empty card). */
function asSpendMtd(data: unknown): SpendMtdData {
  const d = (data ?? {}) as Partial<SpendMtdData>;
  return {
    amount: typeof d.amount === 'number' ? d.amount : 0,
    currency: typeof d.currency === 'string' && d.currency ? d.currency : 'USD',
    windowStart: typeof d.windowStart === 'string' ? d.windowStart : '',
    asOf: typeof d.asOf === 'string' ? d.asOf : '',
    daysElapsed: typeof d.daysElapsed === 'number' ? d.daysElapsed : 0,
  };
}

export function SpendMtdCard({ data, size }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const d = asSpendMtd(data);
  const isSmall = size === 'S'; // AOD-122 slot id (was 'small'; same 1x1 geometry)
  // A run-rate the renderer derives from amount + daysElapsed with no extra request (§5.2); a literal
  // prior-month delta / projection are named future seams (§10). Suppressed before any day is covered.
  const perDay = d.daysElapsed > 0 ? d.amount / d.daysElapsed : null;

  return (
    <View style={styles.body} accessibilityRole="summary" testID="claude-spend-mtd">
      {/* The hero: the MTD total in the §5.1 cents-precision money typography (type.xl, $0.00 included). */}
      <MoneyValue
        amount={d.amount}
        currency={d.currency}
        dollarsSize={theme.type.xl.fontSize ?? 40}
        dollarsWeight={theme.type.xl.fontWeight}
        dollarsColor={theme.colors.text}
        centsColor={theme.colors.textMuted}
        testID="claude-spend-mtd-amount"
      />

      {/* W: the run-rate, the emphasised derived figure ($/day bright, the rest muted). No room at S. */}
      {!isSmall && perDay != null ? (
        <Text style={styles.runRate} numberOfLines={1} testID="claude-spend-mtd-runrate">
          <Text style={styles.runRateValue}>{formatPlainMoney(perDay, d.currency)}</Text>
          <Text style={styles.runRateMuted}>
            /day avg  ·  {d.daysElapsed} {d.daysElapsed === 1 ? 'day' : 'days'} this month
          </Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(1.5) },
  runRate: { ...theme.type.meta },
  runRateValue: { color: theme.colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  runRateMuted: { color: theme.colors.textMuted },
}));
