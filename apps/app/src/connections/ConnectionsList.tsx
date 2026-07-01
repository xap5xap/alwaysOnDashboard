// The connections surface (AOD-8 §10, AOD-9 §7/§10). It renders one row per connectableServices()
// entry from the registry, overlays each with its live connection status, and lets the user connect /
// disconnect / reconnect through the affordance the row derives from authClass. It names no service:
// adding an integration adds a registry entry and this list grows by one row with zero edits here.
//
// AOD-70 canonicalization (design-settings-connections.md §3, §10 drift 5): the section is the AOD-67 §8
// `RowGroup` under a type.caption "CONNECTIONS" heading now, replacing the ad-hoc View + custom heading;
// it sits inside the AOD-21 §6 settings-home section slot (the shell owns the frame). It also computes the
// connect-limit COUNT gate (AOD-12 §7.1, mayConnectAnother) once from the live map and hands each row its
// own verdict, so the row stays generic (§8). The list-level loading ("Checking…" per row) / error states
// are unchanged.
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { mayConnectAnother } from '@vela/shared';
import { useEntitlements } from '../entitlements/useEntitlements';
import { useRegistry } from '../registry/RegistryProvider';
import { RowGroup } from '../ui';
import { ConnectionRow } from './ConnectionRow';
import { useConnectionActions } from './useConnectionActions';
import { useConnections } from './useConnections';

export function ConnectionsList() {
  const registry = useRegistry();
  const services = registry.connectableServices();
  const { connections, isLoading, isError, error } = useConnections();
  const actions = useConnectionActions();
  const entitlements = useEntitlements();

  // The count-gate inputs (AOD-12 §7.1): map the live ConnectionView values to the ConnectionLike shape
  // mayConnectAnother reads. Computed once; each row asks with its OWN service excluded from the count, so
  // reconnecting an already-connected service is never blocked at the limit.
  const connArray = useMemo(
    () => [...connections.values()].map((v) => ({ service: v.service, auth_class: v.authClass, status: v.status })),
    [connections],
  );

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Connections</Text>
      {isError ? (
        <Text style={styles.error} testID="connections-error">
          Could not load your connections. {error?.message ?? ''}
        </Text>
      ) : (
        <RowGroup testID="connections-list">
          {services.map((service) => (
            <ConnectionRow
              key={service.id}
              service={service}
              connection={connections.get(service.id)}
              loading={isLoading}
              actions={actions}
              canConnectAnother={mayConnectAnother(connArray, entitlements, service.id)}
            />
          ))}
        </RowGroup>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.spacing(2),
  },
  // §3 the section heading: type.caption / textMuted, uppercase (the AOD-67 section-label convention).
  heading: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  error: {
    ...theme.type.meta,
    color: theme.colors.error,
  },
}));
