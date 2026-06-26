// Container-band tests: the host resolving a stub instance through the registry + TanStack Query +
// a mock WidgetDataSource, proving the end-to-end loading -> fresh happy path and the 409
// needs_reconnect -> disconnected mapping the AOD-44 proxy produces when there is no connection
// (testing-strategy §9). The flaky stale / error-with-data transitions are covered deterministically
// by the deriveViewState and WidgetHostView unit/component tests.
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetHost } from '../WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../WidgetDataSource';
import { RegistryProvider } from '../../registry/RegistryProvider';
import type { WidgetInstance } from '../../registry/types';

const instance: WidgetInstance = {
  instanceId: 'i1',
  serviceId: 'stub',
  widgetType: 'placeholder',
  config: {},
  size: 'medium',
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

function renderHost(source: WidgetDataSource) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RegistryProvider>
        <WidgetDataSourceProvider source={source}>
          <WidgetHost instance={instance} maxRetries={0} />
        </WidgetDataSourceProvider>
      </RegistryProvider>
    </QueryClientProvider>,
  );
}

describe('WidgetHost container through the proxy data source (testing-strategy §9)', () => {
  it('resolves loading -> fresh and mounts the stub renderer', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { ok: true }, fetchedAt: Date.now() }),
    };
    renderHost(source);

    expect(screen.getByTestId('widget-loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/stub payload/i)).toBeTruthy());
    expect(source.fetch).toHaveBeenCalledWith({ serviceId: 'stub', widgetType: 'placeholder', params: {} });
  });

  it('maps a needs_reconnect proxy error (409) to the disconnected state', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockRejectedValue({ kind: 'needs_reconnect' }),
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
    };
    const onReconfigure = jest.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <RegistryProvider>
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
