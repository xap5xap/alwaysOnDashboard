// The cents-precision money typography (design-claude-usage.md §5.1), shared by the Spend MTD hero
// (type.xl) and the Daily Spend total (type.title). A money value has an internal hierarchy: the dollars
// are the magnitude you glance at, the cents are precision that should not compete. So one value draws in
// three tiers: the dollars at the caller's base size (tabular-nums, colors.text, thousands separators);
// the currency symbol reduced to money.symbolScale and raised toward the dollars' cap height (colors.text);
// the cents reduced to money.fractionScale and dropped to colors.textMuted, BASELINE-ALIGNED with the
// dollars (a calm ambient figure, not a raised retail price tag). Currency is echoed: USD renders "$";
// any other currency keeps identical numerals and trails the currency CODE as a muted type.meta suffix
// (matching the shipped formatMoney). The scales come from theme.money; this component adds no colour of
// its own (the caller passes colors.text / colors.textMuted), keeping the theme token narrow.
import React from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export interface MoneyValueProps {
  amount: number; // major units (dollars); the client never sees cents (types.ts, integration-claude.md §4)
  currency: string; // echoed from the payload; "USD" -> "$", else a code suffix
  dollarsSize: number; // the base step the cents/symbol scale from (type.xl 40 hero / type.title 18 total)
  dollarsWeight: TextStyle['fontWeight'];
  dollarsColor: string; // colors.text
  centsColor: string; // colors.textMuted (the within-value precision tier)
  testID?: string;
}

/** Split a major-unit amount into the three money tiers (§5.1). Spend is non-negative; guarded anyway. */
export function splitMoney(amount: number, currency: string) {
  const fixed = Math.max(0, amount).toFixed(2);
  const [intPart, frac] = fixed.split('.');
  const dollars = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ','); // thousands separators
  const isUsd = currency === 'USD';
  return { symbol: isUsd ? '$' : null, dollars, cents: `.${frac}`, code: isUsd ? null : currency };
}

/** A single-tier money string (the run-rate value, the Daily "today $X.XX" label): same grouping +
 *  echoed-currency rule as the tiered figure, but one font size. USD -> "$4.00"; else -> "4.00 EUR". */
export function formatPlainMoney(amount: number, currency: string): string {
  const { symbol, dollars, cents, code } = splitMoney(amount, currency);
  return `${symbol ?? ''}${dollars}${cents}${code ? ` ${code}` : ''}`;
}

export function MoneyValue({
  amount,
  currency,
  dollarsSize,
  dollarsWeight,
  dollarsColor,
  centsColor,
  testID,
}: MoneyValueProps) {
  const { theme } = useUnistyles();
  const { symbol, dollars, cents, code } = splitMoney(amount, currency);
  const symbolSize = dollarsSize * theme.money.symbolScale;
  const centsSize = dollarsSize * theme.money.fractionScale;
  // Raise the reduced symbol so its cap roughly meets the dollars' cap height (§5.1): the symbol shares
  // the baseline row, so lift it by ~the cap-height difference (0.7 * (1 - symbolScale) * dollarsSize).
  const symbolRaise = dollarsSize * 0.26;

  return (
    <View style={styles.row} testID={testID}>
      {symbol ? (
        <Text
          style={{
            fontSize: symbolSize,
            fontWeight: dollarsWeight,
            color: dollarsColor,
            transform: [{ translateY: -symbolRaise }],
          }}
        >
          {symbol}
        </Text>
      ) : null}
      <Text
        style={{
          fontSize: dollarsSize,
          fontWeight: dollarsWeight,
          color: dollarsColor,
          fontVariant: ['tabular-nums'],
        }}
      >
        {dollars}
      </Text>
      <Text
        style={{
          fontSize: centsSize,
          fontWeight: dollarsWeight,
          color: centsColor,
          fontVariant: ['tabular-nums'],
        }}
      >
        {cents}
      </Text>
      {code ? <Text style={[styles.code, { color: centsColor }]}>{` ${code}`}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  // alignItems baseline so the reduced cents sit on the dollars' baseline (read as one quiet number).
  row: { flexDirection: 'row', alignItems: 'baseline' },
  code: { ...theme.type.meta },
}));
