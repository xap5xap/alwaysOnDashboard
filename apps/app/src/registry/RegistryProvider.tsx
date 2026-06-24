// The registry exposed via React context (AOD-25: "React Context owns host-injected signals (the
// AmbientContext, the registry)"). The widget host and dashboard read the registry from context, so
// tests can inject a custom registry and the engine never imports a specific service module.
import React, { createContext, useContext } from 'react';
import {
  addableWidgets,
  connectableServices,
  getService,
  getWidgetDef,
  SERVICE_REGISTRY,
} from './registry';
import type { ServiceDefinition, ServiceId, WidgetDefinition, WidgetTypeId } from './types';

export interface Registry {
  services: ServiceDefinition[];
  getService(id: ServiceId): ServiceDefinition | undefined;
  getWidgetDef(serviceId: ServiceId, type: WidgetTypeId): WidgetDefinition | undefined;
  connectableServices(): ServiceDefinition[];
  addableWidgets(connected: Set<ServiceId>): WidgetDefinition[];
}

export const defaultRegistry: Registry = {
  services: SERVICE_REGISTRY,
  getService,
  getWidgetDef,
  connectableServices,
  addableWidgets,
};

const RegistryContext = createContext<Registry>(defaultRegistry);

export function RegistryProvider({
  children,
  registry = defaultRegistry,
}: {
  children: React.ReactNode;
  registry?: Registry;
}) {
  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}

export function useRegistry(): Registry {
  return useContext(RegistryContext);
}
