// Container-band tests: the host resolving a stub instance through the registry + TanStack Query +
// a mock WidgetDataSource, proving the end-to-end connecting -> live happy path and the 409
// needs_reconnect -> disconnected mapping the AOD-44 proxy produces when there is no connection
// (testing-strategy §9). The flaky stale / error-with-data transitions are covered deterministically
// by the deriveViewState and WidgetHostView unit/component tests.
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetHost } from '../WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../WidgetDataSource';
import { RegistryProvider } from '../../registry/RegistryProvider';
import { stubRegistry } from '../../registry/__tests__/stubRegistry';
import type { WidgetInstance } from '../../registry/types';

// The host reads useConnections() for the generic platform_key params-seeding (integration-weather.md
// §6.3). Stub it to an empty map so the host has no AuthProvider/supabase dependency here; the stub
// service is platform_key, so with no connection its seeded params stay {} (unchanged from before).
jest.mock('../../connections/useConnections', () => ({
  useConnections: () => ({ connections: new Map(), isLoading: false, isError: false, error: null }),
}));

const instance: WidgetInstance = {
  instanceId: 'i1',
  serviceId: 'stub',
  widgetType: 'placeholder',
  config: {},
  size: 'W', // AOD-122 slot id (was 'medium'; same 2x1 rect)
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

function renderHost(source: WidgetDataSource) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RegistryProvider registry={stubRegistry}>
        <WidgetDataSourceProvider source={source}>
          <WidgetHost instance={instance} maxRetries={0} />
        </WidgetDataSourceProvider>
      </RegistryProvider>
    </QueryClientProvider>,
  );
}

describe('WidgetHost container through the proxy data source (testing-strategy §9)', () => {
  it('resolves connecting -> live and mounts the stub renderer', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { ok: true }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    renderHost(source);

    expect(screen.getByTestId('widget-connecting')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/stub payload/i)).toBeTruthy());
    expect(source.fetch).toHaveBeenCalledWith({ serviceId: 'stub', widgetType: 'placeholder', params: {} });
  });

  it('maps a needs_reconnect proxy error (409) to the disconnected state', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockRejectedValue({ kind: 'needs_reconnect' }),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    renderHost(source);

    await waitFor(() => expect(screen.getByTestId('widget-disconnected')).toBeTruthy());
    expect(screen.queryByText(/stub payload/i)).toBeNull();
  });

  it('renders the needs_config prompt for an invalid config and fires the wired onReconfigure (AOD-10 §4.4)', async () => {
    // The stub's density enum rejects an out-of-set value: validateConfig fails, so the host's
    // render-time config check short-circuits to needs_config regardless of the proxy query (kept
    // in-flight here), proving the config gate takes precedence over the data path.
    const source: WidgetDataSource = {
      fetch: jest.fn().mockReturnValue(new Promise(() => {})),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    const onReconfigure = jest.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <RegistryProvider registry={stubRegistry}>
          <WidgetDataSourceProvider source={source}>
            <WidgetHost
              instance={{ ...instance, config: { density: 'bogus' } }}
              maxRetries={0}
              onReconfigure={onReconfigure}
            />
          </WidgetDataSourceProvider>
        </RegistryProvider>
      </QueryClientProvider>,
    );

    await screen.findByTestId('widget-needs-config');
    expect(screen.queryByText(/stub payload/i)).toBeNull();

    fireEvent.press(screen.getByText('Reconfigure'));
    expect(onReconfigure).toHaveBeenCalled();
  });
});

// The render-time remote-options membership re-check (AOD-10 §4.2 rule 2 / §4.4) on the test registry's
// `placeholder_remote` widget (stubRegistry, injected below). The host resolves the option set through
// the seam and feeds it into needsConfig: a non-member stored value -> needs_config; an unresolved set
// (outage) keeps the selection (unverified passes), so a provider blip never false-trips a placed widget.
const remoteInstance: WidgetInstance = {
  instanceId: 'i2',
  serviceId: 'stub',
  widgetType: 'placeholder_remote',
  config: { project: 'alpha' },
  size: 'W', // AOD-122 slot id (was 'medium'; same 2x1 rect)
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

function renderRemoteHost(source: WidgetDataSource, config: Record<string, unknown>) {
  // retryDelay 0 so a rejected option query settles its retries instantly.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RegistryProvider registry={stubRegistry}>
        <WidgetDataSourceProvider source={source}>
          <WidgetHost instance={{ ...remoteInstance, config }} maxRetries={0} />
        </WidgetDataSourceProvider>
      </RegistryProvider>
    </QueryClientProvider>,
  );
}

describe('WidgetHost render-time remote-options membership re-check (AOD-10 §4.2 rule 2 / §4.4)', () => {
  const choices = [
    { value: 'alpha', label: 'Alpha' },
    { value: 'bravo', label: 'Bravo' },
  ];

  it('resolves normally when the stored value is a member of the option set', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { ok: true }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(choices),
    };
    renderRemoteHost(source, { project: 'alpha' });
    await waitFor(() => expect(screen.getByText(/stub payload/i)).toBeTruthy());
    expect(screen.queryByTestId('widget-needs-config')).toBeNull();
  });

  it('surfaces needs_config when the stored value no longer resolves against the set', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { ok: true }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(choices), // alpha/bravo only; 'ghost' is gone
    };
    renderRemoteHost(source, { project: 'ghost' });
    await screen.findByTestId('widget-needs-config');
    expect(screen.queryByText(/stub payload/i)).toBeNull();
  });

  it('keeps the selection when the option set cannot be resolved (provider outage stays unverified)', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { ok: true }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockRejectedValue({ kind: 'provider_unavailable' }),
    };
    renderRemoteHost(source, { project: 'ghost' });
    // Unresolved options -> membership unverified -> NOT needs_config; the data path proceeds.
    await waitFor(() => expect(screen.getByText(/stub payload/i)).toBeTruthy());
    expect(screen.queryByTestId('widget-needs-config')).toBeNull();
  });
});
