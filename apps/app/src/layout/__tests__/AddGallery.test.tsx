// Component band: the Add-by-Seeing gallery (AOD-147) rendered from an injected registry, with the
// connections read, the current sky, the add insert, and routing mocked. It migrates the old WidgetPicker
// corpus honestly (the addable list, connected-only, configure-on-add, connections states) and adds the
// gallery's new contract: the whole catalog is shown (connected as addable tiles, unconnected as GHOST tiles
// that route to Settings), focusing a tile previews the real card on the sky at its firstFreeSlot landing,
// search filters the shelf, Add STAYS (never leaves Arrange), and — the load-bearing check — a FAKE registry
// widget renders in the gallery with no gallery code change (the seam holds; no per-service branch).
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddGallery } from '../AddGallery';
import { RegistryProvider, type Registry } from '../../registry/RegistryProvider';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../host/WidgetDataSource';
import { dashboardQueryKey } from '../useDashboard';
import type { LoadedDashboard } from '../dashboardRepo';
import type { ConnectionMap, ConnectionView } from '../../connections/connectionsRepo';
import type { ServiceDefinition, WidgetDefinition, WidgetInstance } from '../../registry/types';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../../supabase/client', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../../connections/connectionsRepo', () => ({
  ...jest.requireActual('../../connections/connectionsRepo'), // keep the real connectedServiceIds
  fetchConnections: jest.fn(),
}));
jest.mock('../dashboardRepo', () => ({
  ...jest.requireActual('../dashboardRepo'), // keep bootstrap/load (never called: the cache is seeded fresh)
  addWidgetInstance: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { fetchConnections } from '../../connections/connectionsRepo';
import { addWidgetInstance } from '../dashboardRepo';
import { router } from 'expo-router';

/** A registry widget whose render is an identifiable node, so a tile can be asserted to route through the
 *  widget's OWN renderer (the seam), and the render can be swapped per widget. */
const widget = (
  serviceId: string,
  type: string,
  title: string,
  fields: WidgetDefinition['configSchema']['fields'] = [],
): WidgetDefinition => ({
  type,
  serviceId,
  title,
  supportedSizes: ['S', 'W', 'L'], // AOD-122 slot ids
  defaultRefresh: { seconds: 300 },
  configSchema: { fields },
  render: () => <Text testID={`body-${serviceId}-${type}`}>{title} body</Text>,
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
function makeRegistry(list: ServiceDefinition[]): Registry {
  return {
    services: list,
    getService: (id) => list.find((s) => s.id === id),
    getWidgetDef: (sid, t) => list.find((s) => s.id === sid)?.widgets.find((w) => w.type === t),
    connectableServices: () => list,
    addableWidgets: (connected) =>
      list.filter((s) => s.authClass === 'none' || connected.has(s.id)).flatMap((s) => s.widgets),
  };
}
const registry = makeRegistry(services);

// The focused preview mounts a real WidgetHost, which fetches; resolve so it never errors under test. The
// stub widgets carry no remote-options field, so resolveOptions is never invoked; the provider just exists.
const mockDataSource: WidgetDataSource = {
  fetch: jest.fn().mockResolvedValue({ data: {}, fetchedAt: 0 }),
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

function renderGallery(
  connections: ConnectionMap,
  {
    reg = registry,
    dashboard = { dashboardId: 'dash-1', name: 'Wall', instances: [] } as LoadedDashboard | null,
  }: { reg?: Registry; dashboard?: LoadedDashboard | null } = {},
) {
  // gcTime Infinity (not 0): the seeded dashboard cache has no active observer here, so gcTime:0 would
  // collect it before addWidget reads it; Infinity also schedules no gc timer, so no worker leak.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(dashboardQueryKey('u1'), dashboard);
  (fetchConnections as jest.Mock).mockResolvedValue(connections);
  const onClose = jest.fn();
  render(
    <QueryClientProvider client={client}>
      <RegistryProvider registry={reg}>
        <WidgetDataSourceProvider source={mockDataSource}>
          <AddGallery onClose={onClose} />
        </WidgetDataSourceProvider>
      </RegistryProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

const inst = (instanceId: string, rect: WidgetInstance['rect'], size: WidgetInstance['size'] = 'W'): WidgetInstance => ({
  instanceId,
  serviceId: 'stub',
  widgetType: 'placeholder',
  config: {},
  rect,
  size,
});

beforeEach(() => {
  jest.clearAllMocks();
  (addWidgetInstance as jest.Mock).mockResolvedValue(null);
  (mockDataSource.fetch as jest.Mock).mockResolvedValue({ data: {}, fetchedAt: 0 });
});

describe('the shelf shows the whole catalog: connected as addable tiles, unconnected as ghosts', () => {
  it("renders a connected service's widget as an addable tile and a disconnected one as a ghost", async () => {
    renderGallery(new Map([['stub', conn('stub')]]));
    // stub connected -> an addable tile (a focus target + an Add), rendering the widget's OWN body.
    expect(await screen.findByTestId('add-gallery-tile-stub-placeholder')).toBeTruthy();
    expect(screen.getByTestId('add-gallery-add-stub-placeholder')).toBeTruthy();
    expect(screen.getByTestId('body-stub-placeholder')).toBeTruthy();
    // cal NOT connected -> a ghost tile with a Connect (never an Add), and no live body (the ghost is host-drawn).
    expect(screen.getByTestId('add-gallery-ghost-cal-agenda')).toBeTruthy();
    expect(screen.getByTestId('add-gallery-connect-cal-agenda')).toBeTruthy();
    expect(screen.queryByTestId('add-gallery-add-cal-agenda')).toBeNull();
    expect(screen.queryByTestId('body-cal-agenda')).toBeNull();
  });

  it('a connected-but-unhealthy service (reauth_required) is a ghost, not addable', async () => {
    renderGallery(new Map([['stub', conn('stub', 'reauth_required')]]));
    expect(await screen.findByTestId('add-gallery-ghost-stub-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('add-gallery-add-stub-placeholder')).toBeNull();
  });
});

describe('adding a widget (Add never leaves Arrange)', () => {
  it('inserts the derived default seed into the current dashboard, then STAYS open', async () => {
    const { onClose } = renderGallery(new Map([['stub', conn('stub')]]));
    fireEvent.press(await screen.findByTestId('add-gallery-add-stub-placeholder'));

    await waitFor(() =>
      expect(addWidgetInstance).toHaveBeenCalledWith('dash-1', 'u1', {
        serviceId: 'stub',
        widgetType: 'placeholder',
        config: {},
        size: 'W', // AOD-122 default placement slot
        rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
      }),
    );
    // "Add never leaves Arrange": the sheet is NOT closed after an add.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-gallery')).toBeTruthy();
  });
});

describe('configure-on-add (AOD-10 §4): a widget needing config routes through the form before insert', () => {
  const cfgWidget = widget('cfg', 'configured', 'Configured Widget', [
    { key: 'name', label: 'Name', kind: 'string', required: true },
  ]);
  const cfgService: ServiceDefinition = {
    id: 'cfg',
    displayName: 'Configurable',
    icon: 'x',
    authClass: 'platform_key',
    widgets: [cfgWidget],
  };
  const cfgRegistry = makeRegistry([cfgService]);

  it('opens the config form instead of inserting immediately', async () => {
    renderGallery(new Map([['cfg', conn('cfg')]]), { reg: cfgRegistry });
    fireEvent.press(await screen.findByTestId('add-gallery-add-cfg-configured'));
    expect(await screen.findByTestId('config-form')).toBeTruthy();
    expect(addWidgetInstance).not.toHaveBeenCalled();
  });

  it('inserts with the collected config and STAYS once the form is submitted valid', async () => {
    const { onClose } = renderGallery(new Map([['cfg', conn('cfg')]]), { reg: cfgRegistry });
    fireEvent.press(await screen.findByTestId('add-gallery-add-cfg-configured'));
    fireEvent.changeText(await screen.findByTestId('config-field-name'), 'My Board');
    fireEvent.press(screen.getByTestId('config-submit'));

    await waitFor(() =>
      expect(addWidgetInstance).toHaveBeenCalledWith('dash-1', 'u1', {
        serviceId: 'cfg',
        widgetType: 'configured',
        config: { name: 'My Board' },
        size: 'W',
        rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
      }),
    );
    // Back on the gallery (the config sheet closed), still open for the next card.
    await waitFor(() => expect(screen.getByTestId('add-gallery')).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('the on-sky preview (focus a tile -> the real card at its firstFreeSlot landing)', () => {
  it('drops the focused card onto the sky below the occupied slot (firstFreeSlot), not before focus', async () => {
    // A W card already fills row 0, so a new W lands at row 1 (firstFreeSlot). The preview appears only on focus.
    renderGallery(new Map([['stub', conn('stub')]]), {
      dashboard: { dashboardId: 'dash-1', name: 'Wall', instances: [inst('a', { x: 0, y: 0, w: 2, h: 1, z: 0 })] },
    });
    await screen.findByTestId('add-gallery-tile-stub-placeholder');
    expect(screen.queryByTestId('add-gallery-sky-preview')).toBeNull(); // browsing: no preview yet

    fireEvent.press(screen.getByTestId('add-gallery-tile-stub-placeholder'));
    const preview = await screen.findByTestId('add-gallery-sky-preview');
    const style = StyleSheet.flatten(preview.props.style);
    expect(style.left).toBe(0); // column 0
    expect(style.top).toBeGreaterThan(0); // row >= 1: it landed BELOW the occupied row (firstFreeSlot)
  });
});

describe('search filters the shelf', () => {
  it('keeps only the widgets whose title or service matches the query', async () => {
    renderGallery(
      new Map([
        ['stub', conn('stub')],
        ['cal', conn('cal')],
      ]),
    );
    await screen.findByTestId('add-gallery-tile-stub-placeholder');
    fireEvent.changeText(screen.getByTestId('add-gallery-search'), 'Agenda');

    expect(screen.getByTestId('add-gallery-tile-cal-agenda')).toBeTruthy();
    expect(screen.queryByTestId('add-gallery-tile-stub-placeholder')).toBeNull();
  });

  it('shows a no-matches line when nothing matches', async () => {
    renderGallery(new Map([['stub', conn('stub')]]));
    await screen.findByTestId('add-gallery-tile-stub-placeholder');
    fireEvent.changeText(screen.getByTestId('add-gallery-search'), 'zzz-nothing');
    expect(screen.getByTestId('add-gallery-no-matches')).toBeTruthy();
  });
});

describe('a ghost tile routes to Settings (the connect-via-Settings path; in-place connect is AOD-149)', () => {
  it('Connect closes the gallery and pushes /settings', async () => {
    const { onClose } = renderGallery(new Map()); // nothing connected -> every tile is a ghost
    fireEvent.press(await screen.findByTestId('add-gallery-connect-cal-agenda'));
    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/settings');
  });
});

describe('connections read states', () => {
  it('surfaces a load error pointing at Settings', async () => {
    (fetchConnections as jest.Mock).mockRejectedValue(new Error('down'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    client.setQueryData(dashboardQueryKey('u1'), { dashboardId: 'dash-1', name: 'Wall', instances: [] });
    render(
      <QueryClientProvider client={client}>
        <RegistryProvider registry={registry}>
          <WidgetDataSourceProvider source={mockDataSource}>
            <AddGallery onClose={jest.fn()} />
          </WidgetDataSourceProvider>
        </RegistryProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId('add-gallery-connections-error')).toBeTruthy();
  });
});

describe('the seam: the gallery is generic over the registry (no per-service branch)', () => {
  it('renders a FAKE registry widget — its own tile, its own render, focus->preview — with no gallery code change', async () => {
    const fake: ServiceDefinition = {
      id: 'fake',
      displayName: 'Fake Service',
      icon: 'x',
      authClass: 'platform_key',
      widgets: [widget('fake', 'fakewidget', 'Fake Widget')],
    };
    renderGallery(new Map([['fake', conn('fake')]]), { reg: makeRegistry([fake]) });

    // The gallery, which names no 'fake' anywhere, offers the fake widget as an addable tile that renders the
    // fake widget's OWN renderer — proof the tile routes through registry `render` generically.
    expect(await screen.findByTestId('add-gallery-tile-fake-fakewidget')).toBeTruthy();
    expect(screen.getByTestId('body-fake-fakewidget')).toBeTruthy();
    expect(screen.getByTestId('add-gallery-add-fake-fakewidget')).toBeTruthy();

    // And focusing it previews the real card on the sky — the on-sky preview is registry-driven too.
    fireEvent.press(screen.getByTestId('add-gallery-tile-fake-fakewidget'));
    expect(await screen.findByTestId('add-gallery-sky-preview')).toBeTruthy();
  });
});
