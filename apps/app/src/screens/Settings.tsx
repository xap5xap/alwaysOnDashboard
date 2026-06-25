// Settings entry point. Hosts the connections surface (AOD-50: connect / disconnect / reconnect,
// rendered from the registry and driven by authClass) plus the AOD-12 §6.5 UX-only gate (a locked
// Pro row) against the default Free CustomerInfo. The layout editor and kiosk settings come after.
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { Gate } from '../entitlements/Gate';
import { ConnectionsList } from '../connections/ConnectionsList';

export function Settings() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <ConnectionsList />

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
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing(5),
    paddingTop: rt.insets.top + theme.spacing(5),
    gap: theme.spacing(4),
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
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
