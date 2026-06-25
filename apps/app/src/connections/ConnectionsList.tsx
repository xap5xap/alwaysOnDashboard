// The connections surface (AOD-8 §10, AOD-9 §7/§10). It renders one row per connectableServices()
// entry from the registry, overlays each with its live connection status, and lets the user connect /
// disconnect / reconnect through the affordance the row derives from authClass. It names no service:
// adding an integration adds a registry entry and this list grows by one row with zero edits here.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useRegistry } from '../registry/RegistryProvider';
import { ConnectionRow } from './ConnectionRow';
import { useConnectionActions } from './useConnectionActions';
import { useConnections } from './useConnections';

export function ConnectionsList() {
  const registry = useRegistry();
  const services = registry.connectableServices();
  const { connections, isLoading, isError, error } = useConnections();
  const actions = useConnectionActions();

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Connections</Text>
      {isError ? (
        <Text style={styles.error} testID="connections-error">
          Could not load your connections. {error?.message ?? ''}
        </Text>
      ) : (
        <View>
          {services.map((service) => (
            <ConnectionRow
              key={service.id}
              service={service}
              connection={connections.get(service.id)}
              loading={isLoading}
              actions={actions}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  section: {
    gap: theme.spacing(2),
  },
  heading: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  error: {
    color: theme.colors.error,
    fontSize: 13,
  },
}));
