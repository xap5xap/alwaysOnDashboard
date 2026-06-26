// The widget host container (AOD-8 §9 resolution, AOD-10 §6/§7). It resolves the instance to a
// WidgetDefinition through the registry (invariant 1), runs the AOD-25 device executor (TanStack
// Query: queryKey=requestKey, refetchInterval=effectiveInterval, retryDelay=nextDelaySeconds), maps
// the query snapshot to a WidgetViewState (AOD-10 §7), and hands it to the pure WidgetHostView. It
// never names a specific service.
import React from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRegistry } from '../registry/RegistryProvider';
import type { WidgetConfigSchema, WidgetInstance } from '../registry/types';
import { validateConfig } from '../widgets/config';
import { useOptionSources } from '../widgets/useOptionSources';
import {
  deriveViewState,
  type ProxyError,
  type ProxyResult,
  type WidgetQuerySnapshot,
} from '../widgets/lifecycle';
import { effectiveInterval, nextDelaySeconds, requestKey } from '../widgets/scheduler';
import { useWidgetDataSource } from './WidgetDataSource';
import { WidgetHostView } from './WidgetHostView';

// A stable empty schema for an unresolved instance, so useOptionSources runs no queries (hooks must
// run unconditionally, before the !def early return).
const EMPTY_SCHEMA: WidgetConfigSchema = { fields: [] };

export interface WidgetHostProps {
  instance: WidgetInstance;
  /** AOD-12 supplies this (0 = no tier floor). UX-only here; the server fetch-floor is authoritative. */
  entitlementFloorSeconds?: number;
  now?: () => number;
  maxRetries?: number;
  onReconnect?: () => void;
  onReconfigure?: () => void;
}

export function WidgetHost({
  instance,
  entitlementFloorSeconds = 0,
  now = Date.now,
  maxRetries = 3,
  onReconnect,
  onReconfigure,
}: WidgetHostProps) {
  const registry = useRegistry();
  const dataSource = useWidgetDataSource();
  const def = registry.getWidgetDef(instance.serviceId, instance.widgetType);

  const params = instance.config;
  const key = requestKey(instance.serviceId, instance.widgetType, params);
  const interval = def ? effectiveInterval(def, instance, entitlementFloorSeconds) : 'manual';
  const staleAfterSeconds = interval === 'manual' ? Infinity : interval.seconds;

  // Hooks must run unconditionally; the query is disabled when the instance does not resolve.
  const query = useQuery<ProxyResult, ProxyError>({
    queryKey: [key],
    queryFn: () =>
      dataSource.fetch({ serviceId: instance.serviceId, widgetType: instance.widgetType, params }),
    enabled: !!def,
    refetchInterval: interval === 'manual' ? false : interval.seconds * 1000,
    retry: (failureCount, error) => error?.kind !== 'needs_reconnect' && failureCount < maxRetries,
    retryDelay: (failureCount, error) => {
      const base = staleAfterSeconds === Infinity ? 300 : staleAfterSeconds;
      const d = nextDelaySeconds(base, failureCount - 1, error as ProxyError);
      return d === 'stop' ? 0 : d * 1000;
    },
  });

  // AOD-10 §4.2 rule 2 / §4.4 render-time membership re-check: resolve the def's remote-options sets
  // (riding the shared option-source cache) and feed them into needsConfig below. A stored value that
  // is no longer a member -> needs_config; an unresolved set (provider outage / disconnected) omits
  // the field, so validateConfig accepts it as unverified and a still-valid selection survives.
  const { resolved: resolvedOptions } = useOptionSources(def?.configSchema ?? EMPTY_SCHEMA, instance.serviceId);

  // AOD-8 invariant 1: an unresolved instance is invalid (it would be dropped on a real layout).
  if (!def) {
    return (
      <View testID="widget-unknown">
        <Text>Unknown widget</Text>
      </View>
    );
  }

  // AOD-10 §4.4 render-time config check (host-level): an invalid config, or a remote-options value
  // that no longer resolves against the available option set, is needs_config (§4.2 rule 2).
  const needsConfig = !validateConfig(def.configSchema, instance.config, resolvedOptions).ok;

  // Build the lifecycle snapshot. TanStack Query keeps last data across a failed refetch, so an
  // in-flight retry must not read as an error: only treat as errored when settled (fetchStatus idle)
  // and the error is newer than the data, or when the query has no data at all.
  const hasData = query.data !== undefined;
  const latestError = (query.error ?? (query.failureReason as ProxyError | null)) ?? null;
  const erroredNoData = query.status === 'error';
  const refetchErrored =
    hasData &&
    latestError != null &&
    query.fetchStatus === 'idle' &&
    query.errorUpdatedAt > query.dataUpdatedAt;

  let snapshot: WidgetQuerySnapshot;
  if (!hasData && !erroredNoData) {
    snapshot = { status: 'pending' };
  } else if (erroredNoData) {
    snapshot = { status: 'error', error: latestError ?? { kind: 'provider_unavailable' } };
  } else if (refetchErrored) {
    snapshot = { status: 'error', error: latestError!, lastData: query.data! };
  } else {
    snapshot = { status: 'success', data: query.data!.data, fetchedAt: query.data!.fetchedAt };
  }

  const state = deriveViewState({ needsConfig, query: snapshot, staleAfterSeconds, now: now() });
  const serviceName = registry.getService(instance.serviceId)?.displayName ?? instance.serviceId;

  return (
    <WidgetHostView
      state={state}
      def={def}
      size={instance.size}
      config={instance.config}
      serviceName={serviceName}
      onReconnect={onReconnect}
      onReconfigure={onReconfigure}
      onRetry={() => {
        void query.refetch();
      }}
    />
  );
}
