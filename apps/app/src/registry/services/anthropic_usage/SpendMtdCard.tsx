// The "Spend MTD" leaf renderer (AOD-8 §6.1, integration-claude.md §4.1, design-claude-usage.md §5).
// Reached only on data-bearing lifecycle states; the generic host draws every other state's chrome. It
// receives only { data, config, size } and never branches on auth, loading, or errors. A connected org
// with no spend yet is amount 0, a VALID figure rendered as the hero, not an empty state (§5.3). Currency
// is echoed from the payload, so the card formats without hard-coding $.
//
// AOD-36 polish: the value-first money body. The month-to-date total is the hero, drawn in the §5.1
// cents-precision money typography (MoneyValue: type.xl tabular dollars, a reduced raised $, reduced
// muted baseline-aligned cents). The run-rate is the emphasised derived figure below it: a type.meta line
// whose $/day VALUE is bright (colors.text) and whose label + day count recede (colors.textMuted);
// perDay = amount / daysElapsed, derived here with no extra request (§5.2). The leaf's old hand-drawn
// "Claude Spend (MTD)" label is gone: the host owns the quiet SERVICE · WIDGET caption (§4).
//
// AOD-123: this is the REFERENCE migration onto the shared FitBody (fit-to-bounds, value-at-step,
// truncate-then-drop). The amount is the held VALUE (type.xl, never dropped); the run-rate is the one
// secondary DETAIL line. The leaf no longer branches the run-rate on `isSmall` (the old per-size clip) —
// it always declares it and FitBody drops it when it does not fit the host-passed box HEIGHT. On the two
// slots Spend MTD supports (S 1x1 and W 2x1, both one unit tall ~= a 48px body) a type.xl value already
// fills the height, so the run-rate SHEDS rather than clipping under the card — the AOD-95/97 fix. It
// reappears automatically on any taller slot the widget may gain. VISUAL JUDGMENT (flagged, AOD-123 #5):
// dropping the run-rate leaves the wide-short W value-only; a face that instead reflows the run-rate
// BESIDE the value to use W's width is an M4 decision, not a fit-mechanism one.
import React from 'react';
import { Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { SpendMtdData } from './types';
import { FitBody, type FitLine } from '../../../widgets/FitBody';
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

export function SpendMtdCard({ data, size, box }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const d = asSpendMtd(data);
  // A run-rate the renderer derives from amount + daysElapsed with no extra request (§5.2); a literal
  // prior-month delta / projection are named future seams (§10). Suppressed before any day is covered.
  const perDay = d.daysElapsed > 0 ? d.amount / d.daysElapsed : null;

  // The held value: the MTD total in the §5.1 cents-precision money typography (type.xl, $0.00 included).
  const value: FitLine = {
    key: 'amount',
    role: 'xl',
    node: (
      <MoneyValue
        amount={d.amount}
        currency={d.currency}
        dollarsSize={theme.type.xl.fontSize ?? 40}
        dollarsWeight={theme.type.xl.fontWeight}
        dollarsColor={theme.colors.text}
        centsColor={theme.colors.textMuted}
        testID="claude-spend-mtd-amount"
      />
    ),
  };

  // The one detail line: the run-rate ($/day bright, the rest muted). Declared unconditionally; FitBody
  // truncates it to width then drops it when the box is too short (§7-8), so no per-size branch here.
  const detail: FitLine[] =
    perDay != null
      ? [
          {
            key: 'runrate',
            role: 'meta',
            node: (
              <Text style={styles.runRate} numberOfLines={1} testID="claude-spend-mtd-runrate">
                <Text style={styles.runRateValue}>{formatPlainMoney(perDay, d.currency)}</Text>
                <Text style={styles.runRateMuted}>
                  /day avg  ·  {d.daysElapsed} {d.daysElapsed === 1 ? 'day' : 'days'} this month
                </Text>
              </Text>
            ),
          },
        ]
      : [];

  return (
    <FitBody
      size={size}
      box={box}
      value={value}
      detail={detail}
      gap={theme.spacing(1.5)}
      testID="claude-spend-mtd"
      accessibilityRole="summary"
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  runRate: { ...theme.type.meta },
  runRateValue: { color: theme.colors.text, fontWeight: '600', fontVariant: ['tabular-nums'] },
  runRateMuted: { color: theme.colors.textMuted },
}));
