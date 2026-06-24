// The dashboard screen (AOD-8 §8 DashboardLayout, rendered). It loads the signed-in user's real layout
// from Supabase under RLS (useDashboard: load + bootstrap-if-empty + persist), and mounts the free-form
// layout engine (LayoutCanvas) which renders each instance through the generic WidgetHost. The screen
// owns the arrange-mode flag so both exits work: tapping empty canvas, or the header Done control. It
// never names a service: the AOD-8 seam holds end to end.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { useAuth } from '../auth/AuthProvider';
import { LayoutCanvas } from '../layout/LayoutCanvas';
import { useDashboard } from '../layout/useDashboard';

export function Dashboard() {
  const { session, signOut } = useAuth();
  const { instances, isLoading, isError, error, commit } = useDashboard();
  const [arranging, setArranging] = useState(false);

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
          {arranging ? (
            <Pressable onPress={() => setArranging(false)} accessibilityRole="button">
              <Text style={styles.donePill}>Done</Text>
            </Pressable>
          ) : (
            <>
              <Link href="/settings" asChild>
                <Pressable accessibilityRole="button">
                  <Text style={styles.link}>Settings</Text>
                </Pressable>
              </Link>
              <Pressable onPress={() => void signOut()} accessibilityRole="button">
                <Text style={styles.link}>Sign out</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#6E8BFF" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Could not load your dashboard.</Text>
          <Text style={styles.errorDetail} numberOfLines={3}>
            {error?.message ?? 'Unknown error'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.hint}>
            {arranging
              ? 'Drag to move. Drag the corner handle to resize. Tap empty space or Done to finish.'
              : instances.length
                ? 'Long-press a widget to rearrange.'
                : 'Your dashboard is empty.'}
          </Text>
          <LayoutCanvas
            instances={instances}
            arranging={arranging}
            onEnterArrange={() => setArranging(true)}
            onExitArrange={() => setArranging(false)}
            onCommit={commit}
          />
        </>
      )}
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
    alignItems: 'center',
    gap: theme.spacing(4),
  },
  link: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  donePill: {
    color: theme.colors.background,
    backgroundColor: theme.colors.accent,
    fontSize: 14,
    fontWeight: '700',
    overflow: 'hidden',
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
    paddingHorizontal: theme.spacing(6),
  },
  errorTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  errorDetail: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
}));
