// The "second sky is Pro" invite (AOD-144; design "Many Skies" §1f Take A "the door answers"). A free person
// taps the + and this opens IN PLACE — one line, one quiet door, tapping elsewhere closes it. It is NOT the
// paywall screen (that is a later chat / RB-M4); this is the invitation, and its See Pro is the through-tap
// to the existing /paywall?trigger=dashboards route. "The invitation is architecture, not theater" — so it
// is a small design-system face (a raised Card with the PRO badge + one line + one button) anchored near the
// + it opened from, never a full-screen takeover. Composed from ui/ parts only (AccentBadge / Button / Card):
// no bespoke chrome, no new token.
//
// The routing lives in the caller (SkyPager): this component only reports onSeePro / onDismiss, so the
// billing intent is asserted where it is decided.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { AccentBadge, Button, Card } from '../ui';

export interface ProInviteSliverProps {
  /** The one quiet door: the See Pro tap (the caller routes to the paywall). */
  onSeePro(): void;
  /** Tapping anywhere off the card closes it (§1f "tapping elsewhere closes it. Zero ceremony."). */
  onDismiss(): void;
  testID?: string;
}

export function ProInviteSliver({ onSeePro, onDismiss, testID = 'pro-invite' }: ProInviteSliverProps) {
  const { theme } = useUnistyles();
  return (
    <View style={StyleSheet.absoluteFill} testID={`${testID}-layer`}>
      {/* The dismiss backdrop: a full-bleed press target UNDER the card, so a tap off the card closes the
          invite. No scrim fill — "never a wall"; the surface stays calm. The card (drawn after) sits on top
          and captures its own taps. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        onPress={onDismiss}
        testID={`${testID}-dismiss`}
      />
      {/* Anchored to the bottom, near the + it opened from, so the answer reads as spatial. box-none lets a
          tap in the empty anchor area fall through to the dismiss backdrop below. */}
      <View style={styles.anchor} pointerEvents="box-none">
        <Card style={styles.card} testID={testID}>
          <AccentBadge label="PRO" testID={`${testID}-badge`} />
          <Text style={[theme.type.title, { color: theme.colors.text }]}>A second dashboard is part of Pro.</Text>
          <Button label="See Pro" variant="primary" size="sm" onPress={onSeePro} testID={`${testID}-see-pro`} />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    padding: theme.spacing(5),
  },
  card: {
    alignItems: 'flex-start',
    gap: theme.spacing(3),
    maxWidth: 360,
  },
}));
