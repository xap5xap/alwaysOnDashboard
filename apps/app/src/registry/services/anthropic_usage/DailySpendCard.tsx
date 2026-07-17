// The "Daily Spend Sparkline" leaf renderer (AOD-8 §6.1, integration-claude.md §4.2, design-claude-usage.md
// §6). Reached only on data-bearing lifecycle states; the host draws every other state. Receives only
// { data, config, size }. The server maps each daily bucket to a DailyCost row (cents -> dollars / 100,
// oldest-first, §6.1); this card draws them as the §4 sparkline. An empty days[] is the normal "no spend
// yet this month" state, drawn as the §5.1 EmptyBody, never a crash.
//
// AOD-36 polish: the chart is the hero, the total supports it (the inverse of Spend MTD). The sparkline
// (§4) is the largest, brightest element; the MTD total is a supporting type.title anchor in the §5.1
// money typography with a quiet "MONTH TO DATE" qualifier. At W (2x1; the banner layout the retired 3x1
// wide slot wore pre-AOD-122) a banner (total left, sparkline filling the right); at L a square (a more
// prominent total, a taller sparkline, and the L-only "today $X.XX" value label over the today bar).
// Both show the oldest -> Today axis endpoints so the direction reads. The leaf's old "Claude Daily
// Spend" label is gone: the host owns the caption (§4).
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps } from '../../types';
import type { DailyCost, DailySpendData } from './types';
import { EmptyBody } from '../../../widgets/EmptyBody';
import { MoneyValue, formatPlainMoney } from './MoneyValue';
import { Sparkline } from './Sparkline';
import { ChartEmptyGlyph } from './glyphs';

/** Defensive read: a partial payload renders as the empty body, never a crash (§4.2). */
function asDailySpend(data: unknown): DailySpendData {
  const d = (data ?? {}) as Partial<DailySpendData>;
  const days = Array.isArray(d.days) ? (d.days as DailyCost[]) : [];
  return {
    days,
    currency: typeof d.currency === 'string' && d.currency ? d.currency : 'USD',
    total: typeof d.total === 'number' ? d.total : 0,
  };
}

/** Parse "YYYY-MM-DD" as a LOCAL date and label it "Jun 1" (the oldest-day axis endpoint). */
function axisStartLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function DailySpendCard({ data, size }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const { days, currency, total } = asDailySpend(data);

  if (days.length === 0) {
    // §5.1 empty body: a calm "No spend yet this month" with the per-widget flat-chart glyph, no action
    // (nothing is wrong, the org simply has not spent yet). Wrapped to keep the *-empty testID contract.
    return (
      <View style={styles.fill} testID="claude-daily-spend-empty">
        <EmptyBody
          line="No spend yet this month"
          subline="Costs appear as you use the API"
          glyph={<ChartEmptyGlyph color={theme.colors.accent} />}
        />
      </View>
    );
  }

  const isLarge = size === 'L'; // AOD-122 slot id (was 'large'; same 2x2 geometry)
  // chartHeight.{wide,large} are the pre-slot token-ramp key names (unistyles.ts), not WidgetSize ids.
  const chartHeight = isLarge ? theme.sparkline.chartHeight.large : theme.sparkline.chartHeight.wide;
  const todayAmount = days[days.length - 1]?.amount ?? 0;

  // The supporting MTD anchor (equals SpendMtdData.amount over the same window, §6.1): the §5.1 money
  // typography at the smaller type.title step. Not the hero; the chart is.
  const totalBlock = (
    <View>
      <MoneyValue
        amount={total}
        currency={currency}
        dollarsSize={theme.type.title.fontSize ?? 18}
        dollarsWeight={theme.type.title.fontWeight}
        dollarsColor={theme.colors.text}
        centsColor={theme.colors.textMuted}
        testID="claude-daily-spend-total"
      />
      <Text style={styles.mtdLabel}>MONTH TO DATE</Text>
    </View>
  );

  const spark = (
    <Sparkline
      days={days}
      height={chartHeight}
      barColor={theme.colors.accent}
      baselineColor={theme.colors.border}
      barGap={theme.sparkline.barGap}
      barRadius={theme.sparkline.barRadius}
      minBarHeight={theme.sparkline.minBarHeight}
      todayOpacity={theme.sparkline.todayOpacity}
      pastOpacity={theme.sparkline.pastOpacity}
      testID="claude-sparkline"
    />
  );

  const axis = (
    <View style={styles.axisRow}>
      <Text style={styles.axisStart} numberOfLines={1}>
        {axisStartLabel(days[0].date)}
      </Text>
      <Text style={styles.axisToday} numberOfLines={1}>
        Today
      </Text>
    </View>
  );

  // W (2x1, and any other non-L coerced slot): a banner. The total on the left; the sparkline filling
  // the right with its axis under it.
  if (!isLarge) {
    return (
      <View style={styles.wide} accessibilityRole="summary" testID="claude-daily-spend">
        {totalBlock}
        <View style={styles.wideChart}>
          {spark}
          {axis}
        </View>
      </View>
    );
  }

  // L (2x2): a square. A more prominent total on top; the today value label; a taller sparkline.
  return (
    <View style={styles.large} accessibilityRole="summary" testID="claude-daily-spend">
      {totalBlock}
      <Text style={styles.todayLabel} numberOfLines={1} testID="claude-daily-spend-today">
        today {formatPlainMoney(todayAmount, currency)}
      </Text>
      <View style={styles.largeChart}>
        {spark}
        {axis}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  fill: { flex: 1 },

  // W banner: total left, chart fills right (style keys keep their pre-slot names, AOD-122)
  wide: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(3) },
  wideChart: { flex: 1, gap: theme.spacing(1) },

  // L square: total on top, today label, tall chart
  large: { flex: 1, gap: theme.spacing(1.5) },
  largeChart: { flex: 1, justifyContent: 'flex-end', gap: theme.spacing(1) },

  // "MONTH TO DATE" qualifier under the total (the small tracked badge step), muted
  mtdLabel: { ...theme.type.badge, color: theme.colors.textMuted, marginTop: theme.spacing(0.5) },

  // the L-only "today $X.XX" annotation over the today bar (accent, the one numeric label the chart carries)
  todayLabel: {
    ...theme.type.meta,
    fontWeight: '600',
    color: theme.colors.accent,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },

  // oldest -> Today axis endpoints under the chart; Today bright, the start muted
  axisRow: { flexDirection: 'row', justifyContent: 'space-between' },
  axisStart: { ...theme.type.caption, letterSpacing: 0, color: theme.colors.textMuted },
  axisToday: { ...theme.type.caption, letterSpacing: 0, fontWeight: '700', color: theme.colors.text },
}));
