// The client service registry: the seam (AOD-8 §10). Adding a service is one entry here plus its
// widgets and leaf renderers; the layout engine, the widget host, and Settings are NEVER edited to
// add a service. This is the exact client mirror of the server BACKEND_REGISTRY in
// supabase/functions/_shared/registry.ts. Lookups stay generic over the registry, never naming a
// specific service.
import type { ServiceDefinition, ServiceId, WidgetDefinition, WidgetTypeId } from './types';
import { stubService } from './services/stub';
import { linearService } from './services/linear';

export const SERVICE_REGISTRY: ServiceDefinition[] = [
  stubService,
  linearService, // PS-M3 first real service (AOD-55); My Issues + Current Cycle (integration-linear.md §8).
  // The remaining v1 services (Google Calendar, Claude usage, Weather, Clock) register here the same way,
  // each as an entry + its widgets + leaf renderers, with zero edits to the engine below.
];

export function getService(id: ServiceId): ServiceDefinition | undefined {
  return SERVICE_REGISTRY.find((s) => s.id === id);
}

export function getWidgetDef(serviceId: ServiceId, type: WidgetTypeId): WidgetDefinition | undefined {
  return getService(serviceId)?.widgets.find((w) => w.type === type);
}

/** For Settings: every service the user can connect (AOD-8 §10). */
export function connectableServices(): ServiceDefinition[] {
  return SERVICE_REGISTRY;
}

/**
 * AOD-8 §9 invariant 2: the "add widget" picker offers only widgets whose parent service is
 * connected, with authClass "none" (Clock) the sole exemption. A platform_key service like Weather
 * is NOT exempt (platform_key !== "none"): it has a real connection (the user's location) and its
 * widgets become addable only once that connection exists.
 */
export function addableWidgets(connected: Set<ServiceId>): WidgetDefinition[] {
  return SERVICE_REGISTRY
    .filter((s) => s.authClass === 'none' || connected.has(s.id))
    .flatMap((s) => s.widgets);
}
