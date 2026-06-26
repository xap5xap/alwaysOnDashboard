// The reconfigure entry's container (AOD-10 §4): given the instance the dashboard wants to configure,
// it resolves the widget definition through the registry, pre-fills the generic ConfigForm with the
// instance's current config, and on save persists it under RLS via useConfigureInstance (which then
// invalidates the dashboard query so the host re-derives needsConfig, AOD-10 §4.4). It names no
// service: it reads only the resolved schema, so it reconfigures any widget. Reached two ways, both
// generic: the host's needs_config "Reconfigure" prompt and the arrange-mode "Configure" affordance,
// which both route here through the dashboard's `configuring` state.
import React from 'react';
import { useRegistry } from '../registry/RegistryProvider';
import type { WidgetInstance } from '../registry/types';
import { ResolvedConfigFormModal } from '../widgets/ResolvedConfigFormModal';
import { useConfigureInstance } from './useConfigureInstance';

export interface ConfigureInstanceModalProps {
  instance: WidgetInstance;
  onClose(): void;
}

export function ConfigureInstanceModal({ instance, onClose }: ConfigureInstanceModalProps) {
  const registry = useRegistry();
  const def = registry.getWidgetDef(instance.serviceId, instance.widgetType);
  const { configure, pending, error } = useConfigureInstance();

  // An unresolved instance has no schema to render (AOD-8 invariant 1); nothing to configure.
  if (!def) return null;

  const onSubmit = async (values: Record<string, unknown>) => {
    try {
      await configure(instance.instanceId, values);
      onClose();
    } catch {
      // Surfaced via `error`; keep the form open so the user can retry.
    }
  };

  return (
    <ResolvedConfigFormModal
      serviceId={instance.serviceId}
      schema={def.configSchema}
      initial={instance.config}
      title={`Configure ${def.title}`}
      submitLabel="Save"
      pending={pending}
      submitError={error ? error.message : null}
      onSubmit={(values) => void onSubmit(values)}
      onCancel={onClose}
    />
  );
}
