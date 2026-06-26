// The add-widget picker (AOD-8 §9 invariant 2, §10). A generic affordance that offers exactly
// registry.addableWidgets(connectedSet) -- widgets whose parent service is connected (authClass 'none'
// like Clock is exempt inside addableWidgets) -- grouped by their publishing service. It names no
// service: it reads the registry and the live connection map and renders whatever is addable, so adding
// an integration grows this list by one group with zero edits here. Selecting a widget inserts it into
// the current dashboard (useAddWidget) and closes. When nothing is addable it points to Settings ->
// Connections. Visual design is DS-M1 (AOD-28); this is the functional surface, like AOD-49/AOD-50.
import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { connectedServiceIds } from '../connections/connectionsRepo';
import { useConnections } from '../connections/useConnections';
import { useRegistry } from '../registry/RegistryProvider';
import type { ServiceDefinition, ServiceId, WidgetDefinition } from '../registry/types';
import { useAddWidget } from './useAddWidget';

export interface WidgetPickerProps {
  onClose(): void;
}

interface ServiceGroup {
  service: ServiceDefinition;
  widgets: WidgetDefinition[];
}

/** Group addable widgets under their publishing service, preserving the registry order addableWidgets
 *  returns. Defensive: a widget whose service does not resolve is skipped (AOD-8 §9 invariant 1). */
function groupByService(
  widgets: WidgetDefinition[],
  getService: (id: ServiceId) => ServiceDefinition | undefined,
): ServiceGroup[] {
  const order: ServiceId[] = [];
  const byId = new Map<ServiceId, ServiceGroup>();
  for (const widget of widgets) {
    let group = byId.get(widget.serviceId);
    if (!group) {
      const service = getService(widget.serviceId);
      if (!service) continue;
      group = { service, widgets: [] };
      byId.set(widget.serviceId, group);
      order.push(widget.serviceId);
    }
    group.widgets.push(widget);
  }
  return order.map((id) => byId.get(id) as ServiceGroup);
}

export function WidgetPicker({ onClose }: WidgetPickerProps) {
  const registry = useRegistry();
  const { connections, isLoading, isError } = useConnections();
  const { addWidget, pending, error } = useAddWidget();

  const connected = connectedServiceIds(connections);
  const groups = groupByService(registry.addableWidgets(connected), (id) => registry.getService(id));

  const onAdd = async (def: WidgetDefinition) => {
    try {
      await addWidget(def);
      onClose();
    } catch {
      // Failure is surfaced via `error` below; keep the picker open so the user can retry.
    }
  };

  const goToSettings = () => {
    onClose();
    router.push('/settings');
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add widget</Text>
            <Pressable onPress={onClose} accessibilityRole="button" testID="widget-picker-close">
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          {error && (
            <Text style={styles.error} testID="widget-picker-error">
              {error.message}
            </Text>
          )}

          {isError ? (
            <Text style={styles.muted} testID="widget-picker-connections-error">
              Could not load your connections. Try again from Settings.
            </Text>
          ) : isLoading ? (
            <Text style={styles.muted}>Checking connections...</Text>
          ) : groups.length === 0 ? (
            <View style={styles.empty} testID="widget-picker-empty">
              <Text style={styles.muted}>
                No widgets to add yet. Connect a service in Settings to add its widgets.
              </Text>
              <Pressable onPress={goToSettings} accessibilityRole="button" testID="widget-picker-go-settings">
                <Text style={styles.action}>Open Settings</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {groups.map((group) => (
                <View key={group.service.id} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.service.displayName}</Text>
                  {group.widgets.map((widget) => (
                    <Pressable
                      key={widget.type}
                      onPress={() => void onAdd(widget)}
                      disabled={pending}
                      accessibilityRole="button"
                      testID={`widget-picker-add-${group.service.id}-${widget.type}`}
                      style={styles.item}
                    >
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {widget.title}
                      </Text>
                      <Text style={styles.itemAdd}>{pending ? '...' : 'Add'}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing(5),
    paddingTop: theme.spacing(4),
    paddingBottom: rt.insets.bottom + theme.spacing(4),
    gap: theme.spacing(3),
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  close: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: theme.colors.error,
    fontSize: 13,
  },
  muted: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  empty: {
    gap: theme.spacing(3),
    paddingVertical: theme.spacing(3),
  },
  action: {
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  list: {
    flexGrow: 0,
  },
  group: {
    gap: theme.spacing(1),
    paddingVertical: theme.spacing(2),
  },
  groupLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(3),
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    gap: theme.spacing(3),
  },
  itemTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  itemAdd: {
    color: theme.colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
}));
