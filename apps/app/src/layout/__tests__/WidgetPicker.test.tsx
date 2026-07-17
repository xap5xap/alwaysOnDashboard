// Component band: the add-widget picker rendered from an injected registry, with the connections read,
// the add insert, and routing mocked. It proves the picker is generic over the registry (it offers
// exactly addableWidgets(connectedSet), grouped by service), that connected-only holds (a service that
// is not connected is never offered), that tapping a widget inserts the derived seed into the current
// dashboard, and that the empty state points to Settings (testing-strategy §9).
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetPicker } from '../WidgetPicker';
import { RegistryProvider, type Registry } from '../../registry/RegistryProvider';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../host/WidgetDataSource';
import { dashboardQueryKey } from '../useDashboard';
import type { LoadedDashboard } from '../dashboardRepo';
import type { ConnectionMap, ConnectionView } from '../../connections/connectionsRepo';
import type { ServiceDefinition, WidgetDefinition } from '../../registry/types';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../../supabase/client', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../../connections/connectionsRepo', () => ({
  ...jest.requireActual('../../connections/connectionsRepo'), // keep the real connectedServiceIds
  fetchConnections: jest.fn(),
}));
jest.mock('../dashboardRepo', () => ({ addWidgetInstance: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { fetchConnections } from '../../connections/connectionsRepo';
import { addWidgetInstance } from '../dashboardRepo';
import { router } from 'expo-router';

const widget = (serviceId: string, type: string, title: string): WidgetDefinition => ({
  type,
  serviceId,
  title,
  supportedSizes: ['S', 'W', 'L'], // AOD-122 slot ids
  defaultRefresh: { seconds: 300 },
  configSchema: { fields: [] },
  render: () => null,
});

const stub: ServiceDefinition = {
  id: 'stub',
  displayName: 'Stub',
  icon: 'cube-outline',
  authClass: 'platform_key',
  widgets: [widget('stub', 'placeholder', 'Stub Widget')],
};
const cal: ServiceDefinition = {
  id: 'cal',
  displayName: 'Calendar',
  icon: 'cal',
  authClass: 'oauth2',
  widgets: [widget('cal', 'agenda', 'Agenda')],
};
const services = [stub, cal];

// A registry that mirrors the real addableWidgets predicate (connected-only; authClass 'none' exempt).
const registry: Registry = {
  services,
  getService: (id) => services.find((s) => s.id === id),
  getWidgetDef: (sid, t) => services.find((s) => s.id === sid)?.widgets.find((w) => w.type === t),
  connectableServices: () => services,
  addableWidgets: (connected) =>
    services.filter((s) => s.authClass === 'none' || connected.has(s.id)).flatMap((s) => s.widgets),
};

// configure-on-add renders the resolver-wrapped form, which reads the data-source seam. The test
// widgets carry no remote-options field, so resolveOptions is never invoked; the provider just exists.
const mockDataSource: WidgetDataSource = {
  fetch: jest.fn(),
  resolveOptions: jest.fn().mockResolvedValue([]),
};

const conn = (service: string, status: ConnectionView['status'] = 'connected'): ConnectionView => ({
  connectionId: `c-${service}`,
  service,
  status,
  authClass: 'platform_key',
  accountLabel: null,
  config: null,
});

function renderPicker(
  connections: ConnectionMap,
  dashboard: LoadedDashboard | null = { dashboardId: 'dash-1', name: 'Wall', instances: [] },
) {
  // gcTime Infinity (not 0): the seeded dashboard cache has no active observer here, so gcTime:0 would
  // collect it before addWidget reads it; Infinity also schedules no gc timer, so no worker leak.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(dashboardQueryKey('u1'), dashboard);
  (fetchConnections as jest.Mock).mockResolvedValue(connections);
  const onClose = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <RegistryProvider registry={registry}>
        <WidgetDataSourceProvider source={mockDataSource}>
          <WidgetPicker onClose={onClose} />
        </WidgetDataSourceProvider>
      </RegistryProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

beforeEach(() => {
  jest.clearAllMocks();
  (addWidgetInstance as jest.Mock).mockResolvedValue(null);
});

describe('the picker offers exactly the connected-only addable widgets, grouped by service', () => {
  it("lists a connected service's widget and hides a disconnected one", async () => {
    renderPicker(new Map([['stub', conn('stub')]]));
    await screen.findByText('Stub Widget');
    // findByText (retry), not getByText: the group header can settle a commit after the widget title
    // under load, because the picker also mounts the AOD-53 option-source resolver (AOD-54).
    expect(await screen.findByText('Stub')).toBeTruthy(); // group label = displayName
    expect(screen.queryByText('Agenda')).toBeNull(); // cal is not connected
    expect(screen.queryByText('Calendar')).toBeNull();
  });

  it('lists each connected service as its own group', async () => {
    renderPicker(
      new Map([
        ['stub', conn('stub')],
        ['cal', conn('cal')],
      ]),
    );
    await screen.findByText('Agenda');
    // findByText (retry) for each group: the stub group can render a commit after the cal group under
    // load (the picker mounts the AOD-53 option-source resolver), so a bare getByText flakes (AOD-54).
    expect(await screen.findByText('Stub Widget')).toBeTruthy();
    expect(await screen.findByText('Stub')).toBeTruthy();
    expect(await screen.findByText('Calendar')).toBeTruthy();
  });

  it('does not offer a service that is connected-but-unhealthy (reauth_required)', async () => {
    renderPicker(new Map([['stub', conn('stub', 'reauth_required')]]));
    await screen.findByTestId('widget-picker-empty');
    expect(screen.queryByText('Stub Widget')).toBeNull();
  });
});

describe('adding a widget', () => {
  it('inserts the derived default seed into the current dashboard, then closes', async () => {
    const { onClose } = renderPicker(new Map([['stub', conn('stub')]]));
    fireEvent.press(await screen.findByTestId('widget-picker-add-stub-placeholder'));

    await waitFor(() =>
      expect(addWidgetInstance).toHaveBeenCalledWith('dash-1', 'u1', {
        serviceId: 'stub',
        widgetType: 'placeholder',
        config: {},
        size: 'W', // AOD-122: the default placement slot (was 'medium'; same 2x1 rect)
        rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('configure-on-add (AOD-10 §4): a widget needing config routes through the form before insert', () => {
  const cfgWidget: WidgetDefinition = {
    type: 'configured',
    serviceId: 'cfg',
    title: 'Configured Widget',
    supportedSizes: ['S', 'W', 'L'], // AOD-122 slot ids
    defaultRefresh: { seconds: 300 },
    configSchema: { fields: [{ key: 'name', label: 'Name', kind: 'string', required: true }] },
    render: () => null,
  };
  const cfgService: ServiceDefinition = {
    id: 'cfg',
    displayName: 'Configurable',
    icon: 'x',
    authClass: 'platform_key',
    widgets: [cfgWidget],
  };
  const cfgServices = [cfgService];
  const cfgRegistry: Registry = {
    services: cfgServices,
    getService: (id) => cfgServices.find((s) => s.id === id),
    getWidgetDef: (sid, t) => cfgServices.find((s) => s.id === sid)?.widgets.find((w) => w.type === t),
    connectableServices: () => cfgServices,
    addableWidgets: (connected) => cfgServices.filter((s) => connected.has(s.id)).flatMap((s) => s.widgets),
  };

  function renderCfg() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(dashboardQueryKey('u1'), { dashboardId: 'dash-1', name: 'Wall', instances: [] });
    (fetchConnections as jest.Mock).mockResolvedValue(new Map([['cfg', conn('cfg')]]));
    const onClose = jest.fn();
    render(
      <QueryClientProvider client={client}>
        <RegistryProvider registry={cfgRegistry}>
          <WidgetDataSourceProvider source={mockDataSource}>
            <WidgetPicker onClose={onClose} />
          </WidgetDataSourceProvider>
        </RegistryProvider>
      </QueryClientProvider>,
    );
    return { onClose };
  }

  it('opens the config form instead of inserting immediately', async () => {
    renderCfg();
    fireEvent.press(await screen.findByTestId('widget-picker-add-cfg-configured'));
    expect(await screen.findByTestId('config-form')).toBeTruthy();
    expect(addWidgetInstance).not.toHaveBeenCalled();
  });

  it('inserts with the collected config and closes once the form is submitted valid', async () => {
    const { onClose } = renderCfg();
    fireEvent.press(await screen.findByTestId('widget-picker-add-cfg-configured'));
    fireEvent.changeText(await screen.findByTestId('config-field-name'), 'My Board');
    fireEvent.press(screen.getByTestId('config-submit'));

    await waitFor(() =>
      expect(addWidgetInstance).toHaveBeenCalledWith('dash-1', 'u1', {
        serviceId: 'cfg',
        widgetType: 'configured',
        config: { name: 'My Board' },
        size: 'W', // AOD-122: the default placement slot (was 'medium'; same 2x1 rect)
        rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('empty state', () => {
  it('points to Settings when no service is connected', async () => {
    const { onClose } = renderPicker(new Map());
    await screen.findByTestId('widget-picker-empty');
    expect(screen.queryByText('Stub Widget')).toBeNull();

    fireEvent.press(screen.getByTestId('widget-picker-go-settings'));
    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings');
  });
});
