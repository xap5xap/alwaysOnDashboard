// The add-widget picker (AOD-8 §9 invariant 2, §10; AOD-27 §6 interior). A generic affordance that offers
// exactly registry.addableWidgets(connectedSet) -- widgets whose parent service is connected (authClass
// 'none' like Clock is exempt inside addableWidgets) -- grouped by their publishing service. It names no
// service: it reads the registry and the live connection map and renders whatever is addable, so adding an
// integration grows this list by one group with zero edits here. Selecting a widget inserts it into the
// current dashboard (useAddWidget) and closes.
//
// AOD-69 canonicalization (design-dashboard-editor §6, §11 drift 4): the presentation is now the AOD-21 §7
// in-screen sheet, composed from the AOD-67 `Sheet` (scrim + elevation.overlay surfaceAlt + grabber),
// replacing the hardcoded rgba(0,0,0,0.6) backdrop + `background` fill; each row is the AOD-20 §8 `ListRow`
// (widget title + a trailing accent "Add"), replacing the ad-hoc rows. Configure-on-add still routes a
// required-no-default widget through the config sheet first (AOD-10 §4); everything else adds with defaults.
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';
import { connectedServiceIds } from '../connections/connectionsRepo';
import { useConnections } from '../connections/useConnections';
import { useRegistry } from '../registry/RegistryProvider';
import type { ServiceDefinition, ServiceId, WidgetDefinition } from '../registry/types';
import { ResolvedConfigFormModal } from '../widgets/ResolvedConfigFormModal';
import { Button, ListRow, Sheet } from '../ui';
import { defaultConfig, requiresConfiguration } from './placement';
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

  // A widget whose schema needs values before it can be born valid (a required field with no default)
  // routes through the config form first (AOD-10 §4); everything else adds with schema defaults (AOD-51).
  const [configuring, setConfiguring] = useState<WidgetDefinition | null>(null);

  const onSelect = (def: WidgetDefinition) => {
    if (requiresConfiguration(def.configSchema)) {
      setConfiguring(def);
      return;
    }
    void addAndClose(def);
  };

  const addAndClose = async (def: WidgetDefinition, config?: Record<string, unknown>) => {
    try {
      await addWidget(def, config);
      onClose();
    } catch {
      // Failure is surfaced via `error`; keep the picker (or the config form) open so the user can retry.
    }
  };

  const goToSettings = () => {
    onClose();
    router.push('/settings');
  };

  // When configuring-on-add, the config sheet takes over; a cancel returns to the picker (setConfiguring null).
  if (configuring) {
    return (
      <ResolvedConfigFormModal
        serviceId={configuring.serviceId}
        schema={configuring.configSchema}
        initial={defaultConfig(configuring.configSchema)}
        title={`Configure ${configuring.title}`}
        submitLabel="Add"
        pending={pending}
        submitError={error ? error.message : null}
        onSubmit={(values) => void addAndClose(configuring, values)}
        onCancel={() => setConfiguring(null)}
      />
    );
  }

  return (
    <Sheet visible onRequestClose={onClose} bottomInset={UnistylesRuntime.insets.bottom} testID="widget-picker">
      <View style={styles.header}>
        <Text style={styles.title}>Add widget</Text>
        <Button label="Close" variant="ghost" size="sm" onPress={onClose} testID="widget-picker-close" />
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
          <Text style={styles.muted}>No widgets to add yet. Connect a service in Settings to add its widgets.</Text>
          <Button label="Open Settings" variant="secondary" size="sm" onPress={goToSettings} testID="widget-picker-go-settings" />
        </View>
      ) : (
        <ScrollView style={styles.list}>
          {groups.map((group) => (
            <View key={group.service.id} style={styles.group}>
              <Text style={styles.groupLabel}>{group.service.displayName}</Text>
              {group.widgets.map((widget, i) => (
                <Pressable
                  key={widget.type}
                  onPress={() => onSelect(widget)}
                  disabled={pending}
                  accessibilityRole="button"
                  testID={`widget-picker-add-${group.service.id}-${widget.type}`}
                  style={[styles.row, i > 0 && styles.rowDivider]}
                >
                  <ListRow
                    title={widget.title}
                    trailing={<Text style={styles.add}>{pending ? '...' : 'Add'}</Text>}
                  />
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  title: {
    ...theme.type.title,
    color: theme.colors.text,
  },
  error: {
    ...theme.type.meta,
    color: theme.colors.error,
    marginBottom: theme.spacing(2),
  },
  muted: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
  },
  empty: {
    gap: theme.spacing(3),
    paddingVertical: theme.spacing(3),
  },
  list: {
    flexGrow: 0,
  },
  group: {
    paddingTop: theme.spacing(3),
  },
  // §6 the group label = type.caption / textMuted, uppercase (the publishing service name).
  groupLabel: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    paddingHorizontal: theme.spacing(3),
    paddingBottom: theme.spacing(1),
  },
  // §6 each row = the AOD-20 §8 ListRow; a hairline splits rows within a group.
  row: {},
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  add: {
    ...theme.type.label,
    color: theme.colors.accent,
  },
}));
