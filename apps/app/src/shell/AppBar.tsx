// The app bar (design-core-navigation.md §3): the shell's TWO header patterns, composed from the AOD-20
// components + the §11 `appBar` token group. The app draws its own chrome (headerShown:false app-wide, in
// app/_layout.tsx), so this is a composed header, not the native navigator bar. Exactly two patterns, and
// naming them once is what makes the shell reusable:
//   - hub    : the Dashboard home header. the lowercase `vela` wordmark left (the one place the wordmark
//              appears in-app, brand §4.2) + a `right` action cluster + a 1px bottom border.
//   - pushed : every sub-screen. a back chevron + the screen title (type.title) + an optional `right`
//              action. no bottom border (a pushed screen is content, not a hub).
// The actions a caller passes are AOD-20 ghost Buttons / pressables (§3: "the actions are ghost buttons");
// the bar only fixes the frame. The back chevron reuses the AOD-20 ChevronGlyph rotated 180deg (compose,
// don't rebuild) — the shared chrome glyph family, ~1.7 stroke, round caps.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Wordmark } from '../ui/Surfaces';
import { ChevronGlyph } from '../ui/glyphs';

interface HubProps {
  variant: 'hub';
  /** The glanceable action cluster on the right (Add, Settings, the dashboards-switcher chevron). */
  right?: React.ReactNode;
  testID?: string;
}
interface PushedProps {
  variant: 'pushed';
  title: string;
  /** The back affordance; omit on a root-of-stack screen. Replace/pop is the caller's (router.back). */
  onBack?: () => void;
  /** An optional trailing action (e.g. a "Done" on an editable screen). */
  right?: React.ReactNode;
  testID?: string;
}
export type AppBarProps = HubProps | PushedProps;

export function AppBar(props: AppBarProps) {
  const { theme } = useUnistyles();
  const titleStyle = theme.type[theme.appBar.title];

  if (props.variant === 'hub') {
    return (
      <View style={[styles.bar, styles.hubBorder]} testID={props.testID}>
        <Wordmark testID="appbar-wordmark" />
        <View style={styles.right}>{props.right}</View>
      </View>
    );
  }

  return (
    <View style={styles.bar} testID={props.testID}>
      <View style={styles.leftCluster}>
        {props.onBack ? (
          <Pressable
            onPress={props.onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            testID="appbar-back"
            style={styles.backGlyph}
          >
            <ChevronGlyph color={theme.colors.text} size={22} />
          </Pressable>
        ) : null}
        <Text numberOfLines={1} style={[titleStyle, styles.title]} testID="appbar-title">
          {props.title}
        </Text>
      </View>
      {props.right ? <View style={styles.right}>{props.right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    height: theme.appBar.height,
    paddingHorizontal: theme.appBar.paddingX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: (theme.colors as Record<string, string>)[theme.appBar.background],
  },
  hubBorder: {
    borderBottomWidth: 1,
    borderBottomColor: (theme.colors as Record<string, string>)[theme.appBar.border],
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    flexShrink: 1,
  },
  // The back chevron points right by default; rotate the shared glyph 180deg for the back affordance.
  backGlyph: { transform: [{ rotate: '180deg' }] },
  title: { color: theme.colors.text },
  right: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
}));
