// The boot splash (design-core-navigation.md §4, §8): the gate's `loading` branch. A centered spinner +
// the lowercase `vela` wordmark on the ambient field — the ONE place the app shows a spinner (every other
// load is a shaped Skeleton, §8). It canonicalizes the shipped app/index.tsx ActivityIndicator, now given
// the wordmark and the brand surface. Styled in src/ so the Unistyles babel plugin (root: 'src') covers
// it; the thin route file renders it while the session resolves.
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Wordmark } from '../ui';

export function Splash() {
  const { theme } = useUnistyles();
  return (
    <View style={styles.screen} testID="splash">
      <Wordmark testID="splash-wordmark" />
      <ActivityIndicator color={theme.colors.accent} testID="splash-spinner" />
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(4),
    paddingTop: rt.insets.top,
  },
}));
