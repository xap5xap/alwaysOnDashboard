// Integration band: the AOD-194 "one source of truth for the active sky" contract, proven against REAL
// query caches (design-layout-foundation §9). The bug: the sky you are ON was held in TWO independently
// MMKV-persisted staleTime:Infinity caches — Glance read ['sky', userId, skyId] while Arrange + the wall read
// ['dashboard', userId] — so an interrupted persist could leave them permanently divergent and Glance would
// show a phantom layout Arrange did not. The fix routes the ACTIVE Glance page through ['dashboard'] (the
// exact cache Arrange + the wall use); only NON-active pages keep their own ['sky', id] read.
//
// This test seeds a DIVERGENT ['sky', activeId] (a stale phantom) alongside the TRUE ['dashboard'] layout and
// asserts the active page shows the ['dashboard'] one, never the phantom. A tiny harness mirrors Dashboard's
// real wiring (useDashboards().instances -> SkyPager.activeInstances) using the REAL useDashboard hook and the
// REAL useSkyInstances hook against a pre-seeded QueryClient; only auth, the heavy LayoutCanvas, and the repo
// (never called — every key is seeded fresh) are stubbed, so the cache reads under test run for real.
import React from 'react';
import { render, screen, within, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerInfoProvider } from '../../entitlements/CustomerInfoContext';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
// Never called (every query key is seeded fresh with staleTime:Infinity), but useDashboard / useSkyInstances
// import it — stubbing isolates the network entirely, so a regression that made the active page fetch ['sky']
// would surface as a failed cache assertion, not a real request.
jest.mock('../../layout/dashboardRepo', () => ({
  loadDashboardById: jest.fn(),
  loadDashboard: jest.fn(),
  bootstrapDashboard: jest.fn(),
  persistInstanceLayout: jest.fn(),
}));
// The read-only page body: render just the instance ids it received so the CACHE each page read is assertable.
jest.mock('../../layout/LayoutCanvas', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    LayoutCanvas: ({ instances }: { instances: { instanceId: string }[] }) =>
      React.createElement(
        View,
        { testID: 'layout-canvas' },
        React.createElement(Text, { testID: 'canvas-ids' }, instances.map((i) => i.instanceId).join(',')),
      ),
  };
});

import { loadDashboardById } from '../../layout/dashboardRepo';
import { dashboardQueryKey, useDashboard } from '../../layout/useDashboard';
import { skyQueryKey } from '../../layout/useSkyInstances';
import { SkyPager } from '../SkyPager';

const DASHBOARDS = [
  { id: 'd1', name: 'Wall', position: 0 },
  { id: 'd2', name: 'Travel', position: 1 },
];

// Mirror Dashboard exactly: read the active-sky ['dashboard'] cache and hand its instances to the pager.
function Harness() {
  const { instances } = useDashboard();
  return (
    <SkyPager
      dashboards={DASHBOARDS}
      activeId="d1"
      activeInstances={instances}
      onEnterArrange={() => {}}
      onAddCard={() => {}}
      createDashboard={async () => 'd3'}
      awake
      wake={() => {}}
      onPageChange={() => {}}
    />
  );
}

function seedAndRender() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
  // The TRUE active-sky layout — what Arrange and the kiosk wall render — under ['dashboard', 'u1'].
  client.setQueryData(dashboardQueryKey('u1'), {
    dashboardId: 'd1',
    name: 'Wall',
    instances: [{ instanceId: 'true-a' }, { instanceId: 'true-b' }],
  });
  // A DIVERGENT phantom under the ACTIVE sky's own ['sky', 'u1', 'd1'] — the stale cache the bug left behind.
  // The active page must IGNORE this and read ['dashboard'] instead.
  client.setQueryData(skyQueryKey('u1', 'd1'), {
    dashboardId: 'd1',
    name: 'Wall',
    instances: [{ instanceId: 'phantom' }],
  });
  // The NON-active sky's own layout under ['sky', 'u1', 'd2'] — this one IS what its page should show.
  client.setQueryData(skyQueryKey('u1', 'd2'), {
    dashboardId: 'd2',
    name: 'Travel',
    instances: [{ instanceId: 'd2-x' }],
  });
  return { client, ...render(
    <QueryClientProvider client={client}>
      <CustomerInfoProvider value={{ activeEntitlementIds: [] }}>
        <Harness />
      </CustomerInfoProvider>
    </QueryClientProvider>,
  ) };
}

describe('SkyPager active page — one source of truth (AOD-194, real caches)', () => {
  it('the active page shows the ["dashboard"] layout, never the divergent ["sky", activeId] phantom', () => {
    seedAndRender();
    // d1 is active -> renders ['dashboard'] (true-a,true-b), NOT the 'phantom' from ['sky','u1','d1'].
    expect(within(screen.getByTestId('sky-page-d1')).getByTestId('canvas-ids').props.children).toBe('true-a,true-b');
    // d2 is non-active -> still renders its OWN ['sky','u1','d2'] cache.
    expect(within(screen.getByTestId('sky-page-d2')).getByTestId('canvas-ids').props.children).toBe('d2-x');
    // Every key was pre-seeded fresh, so nothing fetched — the reads came straight off the caches under test.
    expect(loadDashboardById).not.toHaveBeenCalled();
  });

  it('a write to the ["dashboard"] cache repaints the active page (WYSIWYG, e.g. after an Arrange commit)', async () => {
    const { client } = seedAndRender();
    expect(within(screen.getByTestId('sky-page-d1')).getByTestId('canvas-ids').props.children).toBe('true-a,true-b');

    // Simulate a commit(): Arrange (or the wall) writes the ['dashboard'] cache; because the active Glance page
    // reads that SAME cache, it must reflect the change with no ['sky'] hand-off. The query cache notifies its
    // observers asynchronously, so flush inside act + waitFor for the repaint.
    act(() => {
      client.setQueryData(dashboardQueryKey('u1'), {
        dashboardId: 'd1',
        name: 'Wall',
        instances: [{ instanceId: 'true-a' }, { instanceId: 'true-b' }, { instanceId: 'true-c' }],
      });
    });

    await waitFor(() =>
      expect(within(screen.getByTestId('sky-page-d1')).getByTestId('canvas-ids').props.children).toBe('true-a,true-b,true-c'),
    );
  });
});
