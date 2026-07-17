// CurrentCycleCard driven through the real WidgetHost + the registry + TanStack Query + a mock
// WidgetDataSource (testing-strategy §9, mirroring MyIssuesCard.test.tsx). Proves the Linear current_cycle
// path on the client: loading -> fresh renders the progress bar / percent / counts (and the L-only
// "ends in N days"), and active:false renders the shared §5.1 empty body. AOD-30 polish (design-linear.md
// §6): the progress bar is the value, the percent the accent readout; the bar token is fixed off skeleton.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import type { WidgetInstance } from '../../../types';
import type { CurrentCycleData } from '../CurrentCycleCard';

// linear is oauth2, so the host's platform_key seeding is a no-op (params = instance.config); stub the hook
// so the host needs no AuthProvider/supabase here (same as MyIssuesCard.test.tsx).
jest.mock('../../../../connections/useConnections', () => ({
  useConnections: () => ({ connections: new Map(), isLoading: false, isError: false, error: null }),
}));

const largeInstance: WidgetInstance = {
  instanceId: 'cc-lg',
  serviceId: 'linear',
  widgetType: 'current_cycle',
  config: { teamId: 't1' },
  size: 'L', // AOD-122 slot id (was 'large')
  rect: { x: 0, y: 0, w: 2, h: 2, z: 0 },
};
const wInstance: WidgetInstance = { ...largeInstance, instanceId: 'cc-md', size: 'W', rect: { x: 0, y: 0, w: 2, h: 1, z: 0 } };

// The teamId picker resolves through the same seam; t1 is a member so the config validates (else needs_config).
const teamChoices = [{ value: 't1', label: 'Platform & App Shell' }];

const ACTIVE: CurrentCycleData = {
  active: true,
  number: 8,
  name: 'Polish sprint',
  startsAt: '2026-06-20T00:00:00.000Z',
  endsAt: '2099-12-31T00:00:00.000Z', // far future so "ends in N days" is always present at L
  progress: 0.67,
  completedCount: 16,
  totalCount: 24,
};

function renderHost(source: WidgetDataSource, instance: WidgetInstance) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } } });
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

function source(data: CurrentCycleData): WidgetDataSource {
  return {
    fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
    resolveOptions: jest.fn().mockResolvedValue(teamChoices),
  };
}

describe('Linear Current Cycle through the host lifecycle (AOD-30 polish)', () => {
  it('at L renders the percent, the progress bar, the counts, and the "ends in N days" meta', async () => {
    renderHost(source(ACTIVE), largeInstance);

    expect(screen.getByTestId('widget-loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    expect(screen.getByTestId('linear-cycle-pct')).toHaveTextContent('67%');
    expect(screen.getByTestId('linear-cycle-bar')).toBeTruthy();
    expect(screen.getByTestId('linear-cycle-counts')).toHaveTextContent('16 / 24 issues');
    expect(screen.getByTestId('linear-cycle-ends')).toBeTruthy(); // the L-only affordance (§6.2)
    expect(screen.getByText('Cycle 8: Polish sprint')).toBeTruthy();
  });

  it('at W renders the bar + percent + counts but omits the "ends" meta (§6 layout)', async () => {
    renderHost(source(ACTIVE), wInstance);

    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    expect(screen.getByTestId('linear-cycle-pct')).toHaveTextContent('67%');
    expect(screen.getByTestId('linear-cycle-bar')).toBeTruthy();
    expect(screen.getByTestId('linear-cycle-counts')).toHaveTextContent('16 / 24 issues');
    expect(screen.queryByTestId('linear-cycle-ends')).toBeNull();
  });

  it('clamps an out-of-range progress to 100% (§6.1)', async () => {
    renderHost(source({ ...ACTIVE, progress: 1.4 }), largeInstance);
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    expect(screen.getByTestId('linear-cycle-pct')).toHaveTextContent('100%');
  });

  it('falls back to "Cycle N" when the cycle has no name', async () => {
    renderHost(source({ ...ACTIVE, name: null }), largeInstance);
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    expect(screen.getByText('Cycle 8')).toBeTruthy();
  });

  it('renders the §5.1 empty body when the team has no active cycle (active:false, §6.3)', async () => {
    renderHost(source({ active: false }), largeInstance);

    await waitFor(() => expect(screen.getByTestId('linear-cycle-inactive')).toBeTruthy());
    expect(screen.getByTestId('widget-empty-body')).toBeTruthy(); // the shared EmptyBody convention
    expect(screen.queryByTestId('linear-cycle')).toBeNull();
  });
});
