// The screen-level states (design-core-navigation.md §8): a WHOLE surface loading / empty / error,
// distinct from the AOD-37 per-widget lifecycle (drawn inside each card). Composed from the AOD-20
// Skeleton + Button + the type scale. The Splash (§4) is separate. These canonicalize the ad-hoc
// ActivityIndicator load, the inline "Could not load" error, and the empty CTA the shipped Dashboard
// renders (§12 drift 2); the exact empty-DASHBOARD layout stays AOD-27's, these are the generic states.
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Button, Skeleton } from '../ui';

/** §8 loading: a shaped skeleton mirroring the layout (header + rows), a slow shimmer, NOT a spinner. */
export function LoadingState({ rows = 4, testID }: { rows?: number; testID?: string }) {
  return (
    <View style={styles.loading} testID={testID ?? 'screen-loading'}>
      <Skeleton rows={rows} />
    </View>
  );
}

/** §8 empty: a calm CTA in the brand's voice (a muted line + a primary button), NEVER an error treatment.
 *  The optional `glyph` (above the line) and `subline` (a quieter line below) are the AOD-27 §5
 *  empty-DASHBOARD composition inputs: the generic state stays a line + action, the dashboard supplies its
 *  soft accent add glyph + get-started subline through these additive slots (design-dashboard-editor §5). */
export function EmptyState({
  line,
  subline,
  actionLabel,
  onAction,
  glyph,
  testID,
}: {
  line: string;
  subline?: string;
  actionLabel?: string;
  onAction?: () => void;
  glyph?: React.ReactNode;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.center} testID={testID ?? 'screen-empty'}>
      {glyph ?? null}
      <Text style={[theme.type.body, styles.centerText, styles.muted]}>{line}</Text>
      {subline ? <Text style={[theme.type.meta, styles.centerText, styles.muted]}>{subline}</Text> : null}
      {actionLabel ? <Button label={actionLabel} variant="primary" onPress={onAction} testID="screen-empty-action" /> : null}
    </View>
  );
}

/** §8 error: a centered alert glyph + a muted line + ONE accent action (Retry), screen-scaled. */
export function ErrorState({
  line = 'Something went wrong.',
  detail,
  onRetry,
  testID,
}: {
  line?: string;
  detail?: string;
  onRetry?: () => void;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.center} testID={testID ?? 'screen-error'}>
      <AlertGlyph color={theme.colors.textMuted} />
      <Text style={[theme.type.body, styles.centerText, { color: theme.colors.text }]}>{line}</Text>
      {detail ? (
        <Text numberOfLines={3} style={[theme.type.meta, styles.centerText, styles.muted]}>
          {detail}
        </Text>
      ) : null}
      {onRetry ? <Button label="Retry" variant="primary" size="sm" onPress={onRetry} testID="screen-error-retry" /> : null}
    </View>
  );
}

/** A minimal alert mark (a circle + an exclamation) in the shared ~1.7-stroke round-cap family. Scoped to
 *  the shell error state; the colour is the caller's (no theme knowledge), like the AOD-20 glyphs. */
function AlertGlyph({ size = 28, color, strokeWidth = 1.7 }: { size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="-12 -12 24 24" fill="none" testID="alert-glyph">
      <Circle cx={0} cy={0} r={9} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M0 -5 V1.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M0 4.4 V4.6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: { paddingHorizontal: theme.screen.paddingX, paddingTop: theme.screen.gap },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(3),
    paddingHorizontal: theme.spacing(6),
  },
  centerText: { textAlign: 'center' },
  muted: { color: theme.colors.textMuted },
}));
