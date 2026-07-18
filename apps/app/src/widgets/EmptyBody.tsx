// The shared empty-body convention (design-widget-system.md §5.1). A body for a `live` render whose
// CONTENT is legitimately empty (no events, no spend, no active cycle). AOD-125 promoted this to a
// first-class `empty` lifecycle state: whether content is empty is domain-specific, so each widget
// declares an `isEmpty(data)` predicate (registry/types.ts) and the HOST draws this one shared shape
// (WidgetHostView), so the per-widget polish builds (AOD-35/36/30) implement one pattern, not several
// that drift. (Before AOD-125 the leaf drew it inline within its data-bearing states.)
//
// The defining trait is NO ACTION: nothing is wrong, the data simply says "nothing", so unlike the host
// error / needs_config / disconnected prompts (§5) there is nothing to act on. The glyph is per-widget
// (passed in); when omitted it falls back to the neutral RingGlyph. Reuses §3 tokens only (type.body,
// colors.textMuted, colors.accent); adds no new shared token.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { RingGlyph } from './glyphs';

export interface EmptyBodyProps {
  /** What the data says, stated plainly (type.body, textMuted). E.g. "Nothing next". */
  line: string;
  /** Optional quieter reassurance (a smaller step), not an instruction. E.g. "You're clear". */
  subline?: string;
  /** The per-widget line-icon (accent or textMuted). Defaults to the neutral dotted ring. */
  glyph?: React.ReactNode;
}

export function EmptyBody({ line, subline, glyph }: EmptyBodyProps) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.container} testID="widget-empty-body">
      <View style={styles.glyph}>{glyph ?? <RingGlyph color={theme.colors.accent} />}</View>
      <Text style={styles.line} numberOfLines={2}>
        {line}
      </Text>
      {subline ? (
        <Text style={styles.subline} numberOfLines={2}>
          {subline}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1.5),
    paddingVertical: theme.spacing(2),
  },
  glyph: {
    marginBottom: theme.spacing(0.5),
  },
  line: {
    ...theme.type.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  subline: {
    ...theme.type.caption,
    letterSpacing: 0,
    color: theme.colors.textMuted,
    opacity: 0.85,
    textAlign: 'center',
  },
}));
