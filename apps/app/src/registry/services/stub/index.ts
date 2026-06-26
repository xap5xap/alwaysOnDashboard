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
  // Two STATIC config fields (AOD-10 §4.1) so the generic ConfigForm has something to render, exactly
  // as the stub exercises the host lifecycle (AOD-47) and the add flow (AOD-51). Both are
  // optional/defaulted on purpose: validateConfig({}) stays ok, so the AOD-49 bootstrap seed
  // (config: {}) and the AOD-51 add-with-defaults path keep working and the host never false-trips into
  // needs_config. A required-no-default field (configure-on-add) is exercised by a synthetic widget in
  // tests, never by special-casing the stub. remote-options is out of scope here (AOD-10 §4.3).
  configSchema: {
    fields: [
      {
        key: 'density',
        label: 'Density',
        kind: 'enum',
        required: false,
        default: 'comfortable',
        options: [
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'compact', label: 'Compact' },
        ],
      },
      { key: 'label', label: 'Label', kind: 'string', required: false, default: 'Stub', maxLength: 40 },
    ],
  },
  render: StubCard,
};

export const stubService: ServiceDefinition = {
  id: 'stub',
  displayName: 'Stub',
  icon: 'cube-outline',
  authClass: 'platform_key',
  widgets: [stubWidget],
};
