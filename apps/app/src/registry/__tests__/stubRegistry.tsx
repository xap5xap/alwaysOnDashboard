// TEST-ONLY stub service + registry (AOD-126, resolves AOD-94). The walking-skeleton stub used to
// ship as SERVICE_REGISTRY[0] (AOD-47); it now lives here so host/connections tests keep a service
// with exactly the shapes they exercise (platform_key gating, optional/defaulted static config
// fields, a required remote-options field) without any stub reaching production code. Tests inject
// it via RegistryProvider (or import stubService directly for def-level leaf tests); the real
// registry (../registry.ts) carries only real services.
//
// NOT a test file: jest's testMatch collects only __tests__/**/*.test.{ts,tsx}, so this module is
// plain test support and never runs as a suite.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Registry } from '../RegistryProvider';
import type { ServiceDefinition, WidgetDefinition, WidgetRenderProps } from '../types';

function summarize(data: unknown): string {
  if (data === null || data === undefined) return 'no data';
  if (typeof data === 'object') return JSON.stringify(data).slice(0, 120);
  return String(data);
}

/** The stub leaf renderer (ex AOD-8 §6.1): reached only on data-bearing lifecycle states; receives
 *  only { data, config, size } and never branches on auth, loading, or errors. */
export function StubCard({ data, size }: WidgetRenderProps) {
  return (
    <View style={styles.body} accessibilityRole="summary">
      <Text style={styles.label}>stub payload</Text>
      <Text style={styles.value}>{summarize(data)}</Text>
      <Text style={styles.meta}>size: {size}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing(1),
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
}));

// authClass is platform_key (not "none") so the host drives it through the proxy exactly like a
// credentialed widget: with no connection the data source rejects needs_reconnect, which the host
// maps to the disconnected lifecycle state. Both STATIC config fields are optional/defaulted on
// purpose (validateConfig({}) stays ok), so hosting an instance with config {} never false-trips
// into needs_config; a required-no-default field is exercised by synthetic widgets in the tests
// that need one.
const stubWidget: WidgetDefinition = {
  type: 'placeholder',
  serviceId: 'stub',
  title: 'Stub Widget',
  supportedSizes: ['S', 'W', 'L'], // AOD-122 slot ids (was ['small','medium','large'], same geometry)
  defaultRefresh: { seconds: 300 },
  cacheTtlSeconds: 120,
  minRefreshSeconds: 60,
  dimsWithAmbient: true,
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

// The remote-options vehicle (ex AOD-53): a required single remote-options field and an optional
// multiple one, both naming the option source `stub_options`. The required-no-default `project`
// makes requiresConfiguration true, so add flows route through configure-on-add; the host's
// render-time membership re-check (AOD-10 §4.2 rule 2) resolves the set through the data-source
// seam, which tests fake.
const stubRemoteWidget: WidgetDefinition = {
  type: 'placeholder_remote',
  serviceId: 'stub',
  title: 'Stub Remote Widget',
  supportedSizes: ['S', 'W', 'L'], // AOD-122 slot ids (was ['small','medium','large'], same geometry)
  defaultRefresh: { seconds: 300 },
  cacheTtlSeconds: 120,
  minRefreshSeconds: 60,
  dimsWithAmbient: true,
  configSchema: {
    fields: [
      { key: 'project', label: 'Project', kind: 'remote-options', required: true, source: { optionSource: 'stub_options' } },
      { key: 'tags', label: 'Tags', kind: 'remote-options', required: false, multiple: true, default: [], source: { optionSource: 'stub_options' } },
    ],
  },
  render: StubCard,
};

export const stubService: ServiceDefinition = {
  id: 'stub',
  displayName: 'Stub',
  icon: 'cube-outline',
  authClass: 'platform_key',
  widgets: [stubWidget, stubRemoteWidget],
};

/** Build a Registry over `services` mirroring the real predicates (registry.ts), including the
 *  addableWidgets authClass-none exemption, so injected registries behave like the shipped one. */
export function makeTestRegistry(services: ServiceDefinition[]): Registry {
  return {
    services,
    getService: (id) => services.find((s) => s.id === id),
    getWidgetDef: (serviceId, type) =>
      services.find((s) => s.id === serviceId)?.widgets.find((w) => w.type === type),
    connectableServices: () => services,
    addableWidgets: (connected) =>
      services.filter((s) => s.authClass === 'none' || connected.has(s.id)).flatMap((s) => s.widgets),
  };
}

/** The registry the stub-riding host tests inject via RegistryProvider. */
export const stubRegistry: Registry = makeTestRegistry([stubService]);
