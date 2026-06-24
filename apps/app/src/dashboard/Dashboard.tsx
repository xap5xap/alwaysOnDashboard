// The empty dashboard (AOD-8 §8 DashboardLayout, rendered). For the walking skeleton it holds ONE
// placed stub instance and mounts it through the generic WidgetHost; the free-form layout engine
// with persistence is the next PS-M2 task. The board reads instances and mounts the host per
// instance, never naming a service: the AOD-8 seam holds.
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useAuth } from '../auth/AuthProvider';
import { WidgetHost } from '../host/WidgetHost';
import type { WidgetInstance } from '../registry/types';

// One statically placed stub instance. A real layout loads these from widget_instances (RLS) and the
// next task adds drag/resize + persistence.
const placedInstances: WidgetInstance[] = [
  {
    instanceId: 'stub-1',
    serviceId: 'stub',
    widgetType: 'placeholder',
    config: {},
    size: 'medium',
    rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
  },
];

export function Dashboard() {
  const { session, signOut } = useAuth();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.brand}>Vela</Text>
          <Text style={styles.email} numberOfLines={1}>
            {session?.user?.email ?? 'Signed in'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Link href="/settings" asChild>
            <Pressable accessibilityRole="button">
              <Text style={styles.link}>Settings</Text>
            </Pressable>
          </Link>
          <Pressable onPress={() => void signOut()} accessibilityRole="button">
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.board}>
        <Text style={styles.boardHint}>
          Your dashboard is empty. Below is one stub widget resolving through the registry and the
          host state machine.
        </Text>
        {placedInstances.map((instance) => (
          <View key={instance.instanceId} style={styles.placed}>
            <WidgetHost instance={instance} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: rt.insets.top,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
  },
  headerText: {
    flexShrink: 1,
  },
  brand: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  email: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing(4),
  },
  link: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  board: {
    padding: theme.spacing(4),
    gap: theme.spacing(4),
  },
  boardHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  placed: {
    alignSelf: 'flex-start',
  },
}));
