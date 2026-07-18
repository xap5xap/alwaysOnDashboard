// CurrentCycleCard driven through the real WidgetHost + the registry + TanStack Query + a mock
// WidgetDataSource (testing-strategy §9, mirroring MyIssuesCard.test.tsx). Proves the Linear current_cycle
// path on the client: connecting -> live renders THE LOG LINE (AOD-135) — the segmented knot ring (S/M/L) or
// the dash bar (W), the bone percent readout, the counts, and the L-only "ends in N days"; and active:false
// resolves to the host-drawn `empty` phase (AOD-125). The AOD-135 rebuild replaces the AOD-30 progress bar
// (linear-cycle-bar) with the knot ring (linear-cycle-ring) / dash bar (linear-cycle-dashes); the ONE accent
// lives on the lit knots/dashes and the percent is now BONE (colors.text), not accent.
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import type { WidgetInstance } from '../../../types';
import type { CurrentCycleData } from '../CurrentCycleCard';
import { darkTheme } from '../../../../../unistyles';

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
const wInstance: WidgetInstance = { ...largeInstance, instanceId: 'cc-w', size: 'W', rect: { x: 0, y: 0, w: 2, h: 1, z: 0 } };
const mInstance: WidgetInstance = { ...largeInstance, instanceId: 'cc-m', size: 'M', rect: { x: 0, y: 0, w: 1, h: 2, z: 0 } };
const sInstance: WidgetInstance = { ...largeInstance, instanceId: 'cc-s', size: 'S', rect: { x: 0, y: 0, w: 1, h: 1, z: 0 } };

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

describe('Linear Current Cycle — The Log Line through the host lifecycle (AOD-135)', () => {
  it('at L renders the knot ring (one knot per issue, completedCount lit), the bone percent, the counts, and "ends in N days"', async () => {
    renderHost(source(ACTIVE), largeInstance);

    expect(screen.getByTestId('widget-connecting')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    // the ring replaces the AOD-30 bar
    expect(screen.getByTestId('linear-cycle-ring')).toBeTruthy();
    expect(screen.queryByTestId('linear-cycle-bar')).toBeNull(); // the old progress bar is gone
    // one knot per issue: 16 lit + 8 dim = 24 total
    expect(screen.getAllByTestId('linear-cycle-knot-lit')).toHaveLength(16);
    expect(screen.getAllByTestId('linear-cycle-knot-dim')).toHaveLength(8);
    expect(screen.getByTestId('linear-cycle-pct')).toHaveTextContent('67%');
    expect(screen.getByTestId('linear-cycle-counts')).toHaveTextContent('16 / 24 issues');
    expect(screen.getByTestId('linear-cycle-ends')).toBeTruthy(); // the L-only affordance (§6.2)
    expect(screen.getByText('Cycle 8: Polish sprint')).toBeTruthy();
  });

  it('the percent is BONE (colors.text), the brightest thing — never the accent (AOD-135 colour change)', async () => {
    renderHost(source(ACTIVE), largeInstance);
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    const pctColor = StyleSheet.flatten(screen.getByTestId('linear-cycle-pct').props.style).color;
    expect(pctColor).toBe(darkTheme.colors.text); // bone
    expect(pctColor).not.toBe(darkTheme.colors.accent); // the accent is spent on the ring, not the percent
  });

  it('at M renders the full knot ring + label + counts, but no "ends" meta', async () => {
    renderHost(source(ACTIVE), mInstance);
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    expect(screen.getByTestId('linear-cycle-ring')).toBeTruthy();
    expect(screen.getAllByTestId('linear-cycle-knot-lit')).toHaveLength(16);
    expect(screen.getByTestId('linear-cycle-pct')).toHaveTextContent('67%');
    expect(screen.getByTestId('linear-cycle-counts')).toHaveTextContent('16 / 24 issues');
    expect(screen.getByText('Cycle 8: Polish sprint')).toBeTruthy();
    expect(screen.queryByTestId('linear-cycle-ends')).toBeNull();
  });

  it('at S is the compact texture: the ring + the percent, no counts and no label', async () => {
    renderHost(source(ACTIVE), sInstance);
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    expect(screen.getByTestId('linear-cycle-ring')).toBeTruthy();
    expect(screen.getAllByTestId('linear-cycle-knot-lit')).toHaveLength(16); // the texture still reads every issue
    expect(screen.getByTestId('linear-cycle-pct')).toHaveTextContent('67%');
    // S is too small for the counts / label — the percent carries the number
    expect(screen.queryByTestId('linear-cycle-counts')).toBeNull();
    expect(screen.queryByText('Cycle 8: Polish sprint')).toBeNull();
  });

  it('at W renders the segmented DASH bar (linear form: one dash per issue, completedCount lit) + percent + counts, no ring, no ends', async () => {
    renderHost(source(ACTIVE), wInstance);
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    // W is the linear dash form, not the ring
    expect(screen.getByTestId('linear-cycle-dashes')).toBeTruthy();
    expect(screen.queryByTestId('linear-cycle-ring')).toBeNull();
    expect(screen.getAllByTestId('linear-cycle-dash-lit')).toHaveLength(16);
    expect(screen.getAllByTestId('linear-cycle-dash-dim')).toHaveLength(8);
    expect(screen.getByTestId('linear-cycle-pct')).toHaveTextContent('67%');
    expect(screen.getByTestId('linear-cycle-counts')).toHaveTextContent('16 / 24 issues');
    expect(screen.queryByTestId('linear-cycle-ends')).toBeNull();
  });

  it('clamps an out-of-range progress to 100% and lights every knot (§6.1)', async () => {
    renderHost(source({ ...ACTIVE, progress: 1.4, completedCount: 30 }), largeInstance);
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    expect(screen.getByTestId('linear-cycle-pct')).toHaveTextContent('100%');
    // completedCount 30 > totalCount 24 clamps: all 24 lit, none dim
    expect(screen.getAllByTestId('linear-cycle-knot-lit')).toHaveLength(24);
    expect(screen.queryAllByTestId('linear-cycle-knot-dim')).toHaveLength(0);
  });

  it('a 1-issue cycle still reads (a single knot; no ÷0)', async () => {
    renderHost(source({ ...ACTIVE, completedCount: 0, totalCount: 1, progress: 0 }), largeInstance);
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    expect(screen.getAllByTestId('linear-cycle-knot-dim')).toHaveLength(1);
    expect(screen.queryAllByTestId('linear-cycle-knot-lit')).toHaveLength(0);
    expect(screen.getByTestId('linear-cycle-pct')).toHaveTextContent('0%');
  });

  it('falls back to "Cycle N" when the cycle has no name', async () => {
    renderHost(source({ ...ACTIVE, name: null }), largeInstance);
    await waitFor(() => expect(screen.getByTestId('linear-cycle')).toBeTruthy());
    expect(screen.getByText('Cycle 8')).toBeTruthy();
  });

  it('resolves to the host-drawn empty phase when the team has no active cycle (active:false, AOD-125)', async () => {
    renderHost(source({ active: false }), largeInstance);

    // AOD-125: active:false is now the host-drawn `empty` phase (isCurrentCycleEmpty), the shared EmptyBody.
    await waitFor(() => expect(screen.getByTestId('widget-empty-body')).toBeTruthy());
    expect(screen.getByText('Nothing right now.')).toBeTruthy();
    expect(screen.queryByTestId('linear-cycle')).toBeNull();
  });
});
