// Component band: the connections surface rendered from an injected registry, with only the network
// boundary (the connections read + the AOD-44 invokers) and auth mocked. It proves the engine is
// generic over authClass (each row's affordance comes from the class + live status) and that tapping
// an affordance drives the matching Edge Function with the right payload (testing-strategy §9).
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionsList } from '../ConnectionsList';
import { RegistryProvider, type Registry } from '../../registry/RegistryProvider';
import { stubService } from '../../registry/services/stub';
import type { AuthClass, ServiceDefinition } from '../../registry/types';
import type { ConnectionMap } from '../connectionsRepo';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../connectionsRepo', () => ({ fetchConnections: jest.fn() }));
jest.mock('../connectionsApi', () => ({
  startOAuth: jest.fn(),
  storeCredentials: jest.fn(),
  disconnectConnection: jest.fn(),
  openExternalUrl: jest.fn(),
}));
// The location form geocodes the typed city via Open-Meteo (keyless); fake just the network call and
// keep toWeatherLocation/geocodeLabel real so the picked result maps to the stored coordinate shape.
jest.mock('../geocoding', () => ({
  ...jest.requireActual('../geocoding'),
  searchLocations: jest.fn(),
}));

import { fetchConnections } from '../connectionsRepo';
import { startOAuth, storeCredentials, disconnectConnection, openExternalUrl } from '../connectionsApi';
import { searchLocations } from '../geocoding';

const svc = (id: string, authClass: AuthClass): ServiceDefinition => ({
  id,
  displayName: id,
  icon: 'cube-outline',
  authClass,
  widgets: [],
});

// stub (platform_key, no conn) + oauth2 (no conn) + admin_key (connected) + oauth2 (reauth_required).
const services: ServiceDefinition[] = [
  stubService,
  svc('oauthx', 'oauth2'),
  svc('connx', 'admin_key'),
  svc('reauthx', 'oauth2'),
];

const connections: ConnectionMap = new Map([
  ['connx', { connectionId: 'conn-9', service: 'connx', status: 'connected', authClass: 'admin_key', accountLabel: null, config: null }],
  ['reauthx', { connectionId: 'conn-7', service: 'reauthx', status: 'reauth_required', authClass: 'oauth2', accountLabel: null, config: null }],
]);

const registry: Registry = {
  services,
  getService: (id) => services.find((s) => s.id === id),
  getWidgetDef: () => undefined,
  connectableServices: () => services,
  addableWidgets: () => [],
};

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RegistryProvider registry={registry}>
        <ConnectionsList />
      </RegistryProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (fetchConnections as jest.Mock).mockResolvedValue(connections);
  (startOAuth as jest.Mock).mockResolvedValue({ authorizeUrl: 'https://provider.example/authorize?x=1' });
  (storeCredentials as jest.Mock).mockResolvedValue({ ok: true });
  (disconnectConnection as jest.Mock).mockResolvedValue({ ok: true });
  (searchLocations as jest.Mock).mockResolvedValue([
    { id: 1, name: 'Quito', latitude: -0.1807, longitude: -78.4678, timezone: 'America/Guayaquil', country: 'Ecuador', admin1: 'Pichincha' },
  ]);
});

describe('ConnectionsList renders one row per service with the authClass-driven affordance', () => {
  it('shows live status and the right action per (class, status)', async () => {
    renderList();
    // Wait for the owner-read to resolve so the connected/reauth rows settle.
    await screen.findByText('Disconnect');

    // platform_key, no connection -> location form affordance.
    expect(screen.getByTestId('connection-status-stub')).toHaveTextContent('Not connected');
    expect(screen.getByText('Set location')).toBeTruthy();
    // oauth2, no connection -> Connect.
    expect(screen.getByTestId('connection-status-oauthx')).toHaveTextContent('Not connected');
    expect(screen.getByText('Connect')).toBeTruthy();
    // admin_key, connected -> Disconnect.
    expect(screen.getByTestId('connection-status-connx')).toHaveTextContent('Connected');
    // oauth2, reauth_required -> Reconnect.
    expect(screen.getByTestId('connection-status-reauthx')).toHaveTextContent('Reconnect needed');
    expect(screen.getByText('Reconnect')).toBeTruthy();
  });
});

describe('tapping an affordance drives the matching Edge Function', () => {
  it('location connect: geocodes the typed city and submits the picked { location } coordinates', async () => {
    renderList();
    await screen.findByText('Disconnect');

    fireEvent.press(screen.getByTestId('connection-action-stub'));
    fireEvent.changeText(screen.getByPlaceholderText('City, e.g. Quito'), 'Quito');
    fireEvent.press(screen.getByTestId('location-search-submit'));

    // The geocoding result list appears; picking the first result stores its coordinate shape (§5.2).
    await screen.findByTestId('location-result-0');
    fireEvent.press(screen.getByTestId('location-result-0'));

    await waitFor(() =>
      expect(storeCredentials).toHaveBeenCalledWith({
        service: 'stub',
        location: {
          latitude: -0.1807,
          longitude: -78.4678,
          timezone: 'America/Guayaquil',
          name: 'Quito, Pichincha, Ecuador',
        },
      }),
    );
    expect(searchLocations).toHaveBeenCalledWith('Quito');
  });

  it('oauth connect: invokes oauth-start then opens the returned authorize URL', async () => {
    renderList();
    await screen.findByText('Disconnect');

    fireEvent.press(screen.getByTestId('connection-action-oauthx'));

    await waitFor(() => expect(startOAuth).toHaveBeenCalledWith('oauthx'));
    expect(openExternalUrl).toHaveBeenCalledWith('https://provider.example/authorize?x=1');
  });

  it('disconnect: invokes the disconnect Edge Function with the connection id', async () => {
    renderList();
    await screen.findByText('Disconnect');

    fireEvent.press(screen.getByTestId('connection-action-connx'));

    await waitFor(() => expect(disconnectConnection).toHaveBeenCalledWith('conn-9'));
  });
});
