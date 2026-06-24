// The ONE stub service + widget for the app-shell walking skeleton. It exercises the AOD-8 seam and
// the AOD-10 §7 host lifecycle without any PS-M3 integration: there is no real provider.
//
// authClass is platform_key (not "none") so the host drives it through the AOD-44 proxy exactly like
// a credentialed widget. With no connection row, the proxy returns 409 needs_reconnect, which the
// host maps to the disconnected lifecycle state. The matching server half is a stub entry in
// supabase/functions/_shared/registry.ts (BACKEND_REGISTRY) so the live proxy round-trip reaches the
// connection gate rather than failing as an unknown service.
import type { ServiceDefinition, WidgetDefinition } from '../../types';
import { StubCard } from './StubCard';

const stubWidget: WidgetDefinition = {
  type: 'placeholder',
  serviceId: 'stub',
  title: 'Stub Widget',
  supportedSizes: ['small', 'medium', 'large'],
  defaultRefresh: { seconds: 300 }, // device asks every 5 min in foreground (AOD-10 §6.2)
  cacheTtlSeconds: 120, // provider-facing floor (AOD-10 §6.1); never hit in the skeleton
  minRefreshSeconds: 60, // device-cadence floor the author asserts (AOD-10 §6.2)
  dimsWithAmbient: true,
  configSchema: { fields: [] }, // no per-instance config
  render: StubCard,
};

export const stubService: ServiceDefinition = {
  id: 'stub',
  displayName: 'Stub',
  icon: 'cube-outline',
  authClass: 'platform_key',
  widgets: [stubWidget],
};
