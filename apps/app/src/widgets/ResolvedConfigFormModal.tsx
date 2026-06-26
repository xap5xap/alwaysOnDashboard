// Wires the generic ConfigForm to the remote-options resolver (AOD-10 §4.3). It runs useOptionSources
// for the schema's remote-options fields and feeds the per-field states into the pure ConfigForm via
// ConfigFormModal, plus the service display name and a reconnect route for the 409 affordance. Both
// config entry points (configure-on-add in the picker, reconfigure on the dashboard) render this so
// the resolver wiring lives in one place and ConfigForm/ConfigFormModal stay pure and presentational.
import React from 'react';
import { router } from 'expo-router';
import { useRegistry } from '../registry/RegistryProvider';
import type { ConfigFormProps } from './ConfigForm';
import { ConfigFormModal } from './ConfigFormModal';
import { useOptionSources } from './useOptionSources';

export type ResolvedConfigFormModalProps = Omit<
  ConfigFormProps,
  'options' | 'serviceName' | 'onReconnect'
> & {
  /** The widget's parent service: resolves remote-options choices and names the reconnect prompt. */
  serviceId: string;
};

export function ResolvedConfigFormModal({ serviceId, ...formProps }: ResolvedConfigFormModalProps) {
  const registry = useRegistry();
  const { byField } = useOptionSources(formProps.schema, serviceId);
  const serviceName = registry.getService(serviceId)?.displayName ?? serviceId;

  const onReconnect = () => {
    formProps.onCancel();
    router.push('/settings');
  };

  return (
    <ConfigFormModal {...formProps} options={byField} serviceName={serviceName} onReconnect={onReconnect} />
  );
}
