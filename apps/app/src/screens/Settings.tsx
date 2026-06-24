// Settings entry point (stub). The connections surface (connect / disconnect / API-key / reconnect)
// is the next PS-M2 task; the layout editor and kiosk settings come after. Included here so the
// expo-router navigation seam exists and to demonstrate the AOD-12 §6.5 UX-only gate (a locked
// Pro row) against the default Free CustomerInfo.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { Gate } from '../entitlements/Gate';

export function Settings() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.muted}>
        Connections, the layout editor, and kiosk settings land in the next PS-M2 tasks.
      </Text>

      <View style={styles.row}>
        <Gate
          feature="canUseKiosk"
          fallback={<Text style={styles.locked}>Kiosk Mode (Pro, locked)</Text>}
        >
          <Text style={styles.unlocked}>Kiosk Mode</Text>
        </Gate>
      </View>

      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.link}>Back to dashboard</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(5),
    paddingTop: rt.insets.top + theme.spacing(5),
    gap: theme.spacing(3),
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  muted: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  row: {
    paddingVertical: theme.spacing(3),
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
  },
  locked: {
    color: theme.colors.textMuted,
    fontSize: 15,
  },
  unlocked: {
    color: theme.colors.text,
    fontSize: 15,
  },
  link: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
}));
