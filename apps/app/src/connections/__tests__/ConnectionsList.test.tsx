// Component band: the connections surface rendered from an injected registry, with only the network
// boundary (the connections read + the AOD-44 invokers) and auth mocked. It proves the engine is
// generic over authClass (each row's affordance comes from the class + live status), that tapping an
// affordance drives the matching Edge Function with the right payload, that the credential SHEET is the
// AOD-70 canonicalized in-screen sheet (AOD-67 Sheet chrome), and that the connect-limit COUNT gate turns
// a 3rd connect on Free into the AOD-67 LockRow (testing-strategy §9).
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionsList } from '../ConnectionsList';
import { RegistryProvider, type Registry } from '../../registry/RegistryProvider';
import { CustomerInfoProvider } from '../../entitlements/CustomerInfoContext';
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
// The connect-limit LockRow routes to the paywall via the imperative router; mock it so the press is
// observable without a router root. ConnectionRow is the only consumer here.
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
// The location form geocodes the typed city via Open-Meteo (keyless); fake just the network call and
// keep toWeatherLocation/geocodeLabel real so the picked result maps to the stored coordinate shape.
jest.mock('../geocoding', () => ({
  ...jest.requireActual('../geocoding'),
  searchLocations: jest.fn(),
}));

import { router } from 'expo-router';
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

const makeRegistry = (svcs: ServiceDefinition[]): Registry => ({
  services: svcs,
  getService: (id) => svcs.find((s) => s.id === id),
  getWidgetDef: () => undefined,
  connectableServices: () => svcs,
  addableWidgets: () => [],
});

/** Render the list. `pro` (default) removes the connect-limit gate so affordance/action tests are clean;
 *  the gate test passes pro=false (Free). `svcs` overrides the registry for the key-variant test. */
function renderList({ svcs = services, pro = true }: { svcs?: ServiceDefinition[]; pro?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <CustomerInfoProvider value={{ activeEntitlementIds: pro ? ['pro'] : [] }}>
        <RegistryProvider registry={makeRegistry(svcs)}>
          <ConnectionsList />
        </RegistryProvider>
      </CustomerInfoProvider>
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
    expect(within(screen.getByTestId('connection-row-stub')).getByText('Not connected')).toBeTruthy();
    expect(screen.getByText('Set location')).toBeTruthy();
    // oauth2, no connection -> Connect.
    expect(within(screen.getByTestId('connection-row-oauthx')).getByText('Not connected')).toBeTruthy();
    expect(screen.getByText('Connect')).toBeTruthy();
    // admin_key, connected -> Disconnect.
    expect(within(screen.getByTestId('connection-row-connx')).getByText('Connected')).toBeTruthy();
    // oauth2, reauth_required -> Reconnect, with the warning dot leading (§9 row 3).
    expect(within(screen.getByTestId('connection-row-reauthx')).getByText('Reconnect needed')).toBeTruthy();
    expect(screen.getByText('Reconnect')).toBeTruthy();
    expect(within(screen.getByTestId('connection-row-reauthx')).getByTestId('connection-warning-dot')).toBeTruthy();
  });
});

describe('tapping an affordance drives the matching Edge Function', () => {
  it('location connect: opens the AOD-67 sheet, geocodes the city, submits the picked { location }', async () => {
    renderList();
    await screen.findByText('Disconnect');

    fireEvent.press(screen.getByTestId('connection-action-stub'));

    // The canonicalized in-screen sheet: AOD-67 Sheet chrome (grabber) + the "Connect <Service>" header.
    expect(screen.getByTestId('credential-sheet')).toBeTruthy();
    expect(screen.getByTestId('sheet-grabber')).toBeTruthy();
    expect(screen.getByText('Connect Stub')).toBeTruthy();

    fireEvent.changeText(screen.getByPlaceholderText('City, e.g. Quito'), 'Quito');
    fireEvent.press(screen.getByTestId('search-row-submit'));

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

  it('key connect: opens the AOD-67 secret-field sheet and submits { apiKey }', async () => {
    renderList({ svcs: [svc('keyx', 'admin_key')] });
    // No connection row -> the admin_key affordance is "Add key".
    await screen.findByText('Add key');

    fireEvent.press(screen.getByTestId('connection-action-keyx'));
    expect(screen.getByTestId('credential-sheet')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('credential-form-key'), 'sk-ant-admin-secret');
    fireEvent.press(screen.getByTestId('credential-form-submit'));

    await waitFor(() =>
      expect(storeCredentials).toHaveBeenCalledWith({ service: 'keyx', apiKey: 'sk-ant-admin-secret' }),
    );
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

describe('the connect-limit gate (AOD-12 §7.1)', () => {
  it('on Free at the cap, a 3rd Connect becomes the LockRow -> Paywall; reconnect/disconnect are never gated', async () => {
    // Free default (maxConnectedServices 2); connx (connected) + reauthx (reauth_required) already fill both
    // slots, so connecting a 3rd backend service (oauthx / stub) is gated.
    renderList({ pro: false });
    await screen.findByText('Disconnect');

    // The gated connect is the lock row, not the connect action.
    expect(screen.getByTestId('connection-locked-oauthx')).toBeTruthy();
    expect(screen.queryByTestId('connection-action-oauthx')).toBeNull();
    expect(screen.getByTestId('connection-locked-stub')).toBeTruthy();

    // Reconnect (reauthx) and Disconnect (connx) are never gated: the target is excluded from the count.
    expect(within(screen.getByTestId('connection-row-connx')).getByText('Disconnect')).toBeTruthy();
    expect(within(screen.getByTestId('connection-row-reauthx')).getByText('Reconnect')).toBeTruthy();

    // Tapping the lock routes to the paywall with the services trigger (UX-only; the server enforces).
    fireEvent.press(screen.getByTestId('connection-locked-oauthx'));
    expect(router.push).toHaveBeenCalledWith('/paywall?trigger=services');
  });
});
