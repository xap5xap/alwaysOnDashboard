// The client service registry: the seam (AOD-8 §10). Adding a service is one entry here plus its
// widgets and leaf renderers; the layout engine, the widget host, and Settings are NEVER edited to
// add a service. This is the exact client mirror of the server BACKEND_REGISTRY in
// supabase/functions/_shared/registry.ts. Lookups stay generic over the registry, never naming a
// specific service.
import type { ServiceDefinition, ServiceId, WidgetDefinition, WidgetTypeId } from './types';
import { stubService } from './services/stub';
import { linearService } from './services/linear';
import { googleCalendarService } from './services/google_calendar';
import { weatherService } from './services/weather';
import { anthropicUsageService } from './services/anthropic_usage';
import { clockService } from './services/clock';

export const SERVICE_REGISTRY: ServiceDefinition[] = [
  stubService,
  linearService, // PS-M3 first real service (AOD-55); My Issues + Current Cycle (integration-linear.md §8).
  googleCalendarService, // I-M1 second real service (AOD-56), first REST one; Next Event + Today's Agenda (integration-calendar.md §8).
  weatherService, // I-M1 third real service (AOD-58), first platform_key one; Current + Forecast (integration-weather.md §8).
  anthropicUsageService, // I-M2 fourth real service (AOD-59), first admin_key one; Spend MTD + Daily Spend (integration-claude.md §8).
  clockService, // I-M3 fifth and final v1 service (AOD-60), the only authClass 'none' one; CLIENT HALF ONLY (no server registry), addable with no connection, self-ticks from the device clock (integration-clock.md §8).
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
