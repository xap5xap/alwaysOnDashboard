// The generic widget host chrome (AOD-8 §6.1, AOD-10 §7.3). Pure and presentational: given a
// WidgetViewState it renders the loading / error / needs-config / disconnected chrome, and on
// data-bearing states (fresh / stale / error-with-data) it mounts the widget's own renderer with
// { data, config, size } and overlays staleness/error badges as host chrome. It branches on the
// view state, never on which service. Splitting this from the container keeps lifecycle rendering
// deterministic to test (testing-strategy §9).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetDefinition, WidgetSize } from '../registry/types';
import { invokesRenderer, type WidgetViewState } from '../widgets/lifecycle';

export interface WidgetHostViewProps {
  state: WidgetViewState;
  def: WidgetDefinition;
  size: WidgetSize;
  config: Record<string, unknown>;
  serviceName: string;
  onReconnect?: () => void;
  onReconfigure?: () => void;
  onRetry?: () => void;
}

function dataOf(state: WidgetViewState): unknown {
  if (state.phase === 'fresh' || state.phase === 'stale') return state.data;
  if (state.phase === 'error') return state.data;
  return undefined;
}

export function WidgetHostView({
  state,
  def,
  size,
  config,
  serviceName,
  onReconnect,
  onReconfigure,
  onRetry,
}: WidgetHostViewProps) {
  const Renderer = def.render;
  const showData = invokesRenderer(state);

  return (
    <View style={styles.card} testID="widget-card">
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {def.title}
        </Text>
        {state.phase === 'stale' && (
          <Text style={styles.badge} testID="widget-stale-badge">
            stale
          </Text>
        )}
        {state.phase === 'error' && showData && (
          <Text style={[styles.badge, styles.badgeError]} testID="widget-error-badge">
            error
          </Text>
        )}
      </View>

      <View style={styles.body}>
        {state.phase === 'loading' && (
          <View style={styles.skeleton} testID="widget-loading" accessibilityLabel="Loading" />
        )}

        {showData && <Renderer data={dataOf(state)} config={config} size={size} />}

        {state.phase === 'error' && !showData && (
          <View style={styles.prompt} testID="widget-error">
            <Text style={styles.muted}>Could not load.</Text>
            {onRetry && (
              <Pressable onPress={onRetry} accessibilityRole="button">
                <Text style={styles.action}>Retry</Text>
              </Pressable>
            )}
          </View>
        )}

        {state.phase === 'needs_config' && (
          <View style={styles.prompt} testID="widget-needs-config">
            <Text style={styles.muted}>Reconfigure this widget.</Text>
            {onReconfigure && (
              <Pressable onPress={onReconfigure} accessibilityRole="button">
                <Text style={styles.action}>Reconfigure</Text>
              </Pressable>
            )}
          </View>
        )}

        {state.phase === 'disconnected' && (
          <View style={styles.prompt} testID="widget-disconnected">
            <Text style={styles.muted}>Connect {serviceName} to use this widget.</Text>
            {onReconnect && (
              <Pressable onPress={onReconnect} accessibilityRole="button">
                <Text style={styles.action}>Connect</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing(3),
    gap: theme.spacing(2),
    minWidth: 160,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  title: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  badge: {
    color: theme.colors.warning,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgeError: {
    color: theme.colors.error,
  },
  body: {
    gap: theme.spacing(2),
  },
  skeleton: {
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.skeleton,
  },
  prompt: {
    gap: theme.spacing(2),
  },
  muted: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  action: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
}));
