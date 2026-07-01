// The screen frame (design-core-navigation.md §3): the dark ambient field + the top safe-area inset every
// surface sits inside. Flat (no shadow), the same ambient rule the widget card follows. The AppBar mounts
// flush at the top; the content body is padded by the §11 `screen` token group. Styled in src/ so the
// Unistyles babel plugin covers it; the thin route files render <Screen> around their AppBar + content.
import React from 'react';
import { ScrollView, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

/** §3 the frame: fills colors.background and insets the top safe-area. The AppBar sits flush at the top. */
export function Screen({
  children,
  style,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View style={[styles.frame, style]} testID={testID}>
      {children}
    </View>
  );
}

/** §3 the padded content region below the AppBar: side padding + the inter-section gap from the `screen`
 *  group. A ScrollView by default (Settings / Account scroll); pass `scroll={false}` for a fixed body. */
export function ScreenBody({
  children,
  scroll = true,
  contentStyle,
  testID,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  if (scroll) {
    return (
      <ScrollView style={styles.bodyFlex} contentContainerStyle={[styles.bodyContent, contentStyle]} testID={testID}>
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={[styles.bodyFlex, styles.bodyContent, contentStyle]} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  frame: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: rt.insets.top,
  },
  bodyFlex: { flex: 1 },
  bodyContent: {
    paddingHorizontal: theme.screen.paddingX,
    paddingTop: theme.screen.gap,
    paddingBottom: theme.screen.gap,
    gap: theme.screen.gap,
  },
}));
