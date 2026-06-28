// The "Spend MTD" leaf renderer (AOD-8 §6.1, integration-claude.md §4.1). Reached only on data-bearing
// lifecycle states; the generic host draws every other state's chrome. It receives only { data, config,
// size } and never branches on auth, loading, or errors. A connected org with no spend yet is amount 0,
// a valid figure, not an empty state (§4.1). Currency is echoed from the payload, so the card formats
// without hard-coding $. Functional and on-brand-enough; the spend typography polish is a design
// follow-up (§10).
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { SpendMtdData } from './types';

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

/** Major-unit money with the echoed currency: a $ symbol for USD, else a code suffix (§4.0a). */
function formatMoney(amount: number, currency: string): string {
  const fixed = amount.toFixed(2);
  return currency === 'USD' ? `$${fixed}` : `${fixed} ${currency}`;
}

export function SpendMtdCard({ data }: WidgetRenderProps) {
  const d = asSpendMtd(data);
  // A run-rate the renderer derives from amount + daysElapsed with no extra request (§4.1); a literal
  // prior-month delta is a named future seam (§10).
  const perDay = d.daysElapsed > 0 ? d.amount / d.daysElapsed : null;

  return (
    <View style={styles.body} accessibilityRole="summary" testID="claude-spend-mtd">
      <Text style={styles.label} numberOfLines={1}>
        Claude Spend (MTD)
      </Text>
      <Text style={styles.amount} numberOfLines={1} testID="claude-spend-mtd-amount">
        {formatMoney(d.amount, d.currency)}
      </Text>
      <View style={styles.meta}>
        {perDay != null ? (
          <Text style={styles.metaItem} numberOfLines={1}>
            {formatMoney(perDay, d.currency)}/day avg
          </Text>
        ) : null}
        {d.daysElapsed > 0 ? (
          <Text style={styles.metaItem} numberOfLines={1}>
            {d.daysElapsed} {d.daysElapsed === 1 ? 'day' : 'days'} this month
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(1) },
  label: { color: theme.colors.accent, fontSize: 13, fontWeight: '600' },
  amount: { color: theme.colors.text, fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  meta: { gap: theme.spacing(0.5), paddingTop: theme.spacing(1) },
  metaItem: { color: theme.colors.textMuted, fontSize: 13 },
}));
