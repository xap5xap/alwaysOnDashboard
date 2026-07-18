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
// AOD-123 (attempt 2): migrated onto the shared FitBody. The amount is the WIDTH-FIT value: the money
// typography at its type.xl step when it fits, scaled down by min(widthScale, heightScale) otherwise, so a
// long "$1,234.56" never clips the narrow S cell (the AOD-95 class of bug — the S money was ~110px in a
// 72px cell). The run-rate is the one secondary DETAIL line, eligible above S (the S 1x1 stays the minimal
// glance, §5); at the wide-short W the VALUE YIELDS height so the run-rate is KEPT with a smaller amount
// rather than dropped (the anti-regression rule). A taller slot shows a larger amount + the run-rate.
import React from 'react';
import { Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { SpendMtdData } from './types';
import { FitBody, type FitLine, type FitValue } from '../../../widgets/FitBody';
import { tabularWidth } from '../../../widgets/fitLadder';
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
  const isSmall = size === 'S';
  // A run-rate the renderer derives from amount + daysElapsed with no extra request (§5.2); a literal
  // prior-month delta / projection are named future seams (§10). Suppressed before any day is covered.
  const perDay = d.daysElapsed > 0 ? d.amount / d.daysElapsed : null;

  // The width-fit value: the MTD total in the §5.1 cents-precision money typography. baseSize is type.xl;
  // intrinsicWidth over-estimates the full string at that step (MoneyValue draws the $ and cents reduced,
  // so this is conservative) so the money never clips a narrow cell.
  const baseSize = theme.type.xl.fontSize ?? 40;
  const value: FitValue = {
    key: 'amount',
    baseSize,
    intrinsicWidth: tabularWidth(formatPlainMoney(d.amount, d.currency), baseSize),
    render: (fontSize) => (
      <MoneyValue
        amount={d.amount}
        currency={d.currency}
        dollarsSize={fontSize}
        dollarsWeight={theme.type.xl.fontWeight}
        dollarsColor={theme.colors.text}
        centsColor={theme.colors.textMuted}
        testID="claude-spend-mtd-amount"
      />
    ),
  };

  // The one detail line: the run-rate ($/day bright, the rest muted). Eligible above S (the 1x1 stays the
  // minimal glance, §5); FitBody keeps it wherever it fits (the value yields height), only truncating /
  // dropping it when the box genuinely cannot seat it.
  const detail: FitLine[] =
    !isSmall && perDay != null
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
