// SpendMtdCard + DailySpendCard driven through the real WidgetHost + the registry + TanStack Query + a
// mock WidgetDataSource (testing-strategy §9, mirroring services/weather/__tests__/WeatherCards.test.tsx).
// It also pins the admin_key host params behavior (integration-claude.md §6.3): unlike platform_key
// (Weather), an admin_key service is zero-config and takes the host's UNCHANGED else-branch, so the proxy
// params are instance.config (empty) and connection.config is NOT merged in. The cents->dollars /100 lives
// server-side (operations.ts); the card receives an already-normalized payload, so these assert rendering.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import type { WidgetInstance } from '../../../types';
import type { ConnectionMap, ConnectionView } from '../../../../connections/connectionsRepo';
import type { DailySpendData, SpendMtdData } from '../types';

// The host reads useConnections() for the platform_key params-seeding (§6.3). Drive it from a mutable map
// per test (the factory reads the current value at render time); no AuthProvider/supabase needed.
let mockConnections: ConnectionMap = new Map();
jest.mock('../../../../connections/useConnections', () => ({
  useConnections: () => ({ connections: mockConnections, isLoading: false, isError: false, error: null }),
}));

function connection(service: string, authClass: ConnectionView['authClass'], config: Record<string, unknown>): ConnectionView {
  return { connectionId: `c-${service}`, service, status: 'connected', authClass, accountLabel: null, config };
}

const spendInstance: WidgetInstance = {
  instanceId: 'au-spend',
  serviceId: 'anthropic_usage',
  widgetType: 'spend_mtd',
  config: {}, // zero-config: org-wide totals, no per-instance choice (§5.1)
  size: 'small',
  rect: { x: 0, y: 0, w: 1, h: 1, z: 0 },
};

const dailyInstance: WidgetInstance = {
  instanceId: 'au-daily',
  serviceId: 'anthropic_usage',
  widgetType: 'daily_spend',
  config: {},
  size: 'wide',
  rect: { x: 0, y: 0, w: 3, h: 1, z: 0 },
};

const SPEND_MTD_DATA: SpendMtdData = {
  amount: 4, // already normalized server-side: 150.00 + 250.00 cents / 100 = $4.00
  currency: 'USD',
  windowStart: '2026-06-01',
  asOf: '2026-06-02',
  daysElapsed: 2,
};

const DAILY_SPEND_DATA: DailySpendData = {
  currency: 'USD',
  total: 4,
  days: [
    { date: '2026-06-01', amount: 1.5 },
    { date: '2026-06-02', amount: 2.5 },
  ],
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

beforeEach(() => {
  mockConnections = new Map();
});

describe('admin_key host params (integration-claude.md §6.3): the host else-branch, no params-seeding', () => {
  it('sends params = instance.config (empty), NOT connection.config, for an admin_key (claude) widget', async () => {
    // The connection carries config; admin_key is NOT platform_key, so the host takes the else-branch and
    // the zero-config instance config ({}) flows through unchanged. This proves WidgetHost is untouched.
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', { ignored: 'conn-config' })]]);
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: SPEND_MTD_DATA, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    renderHost(source, spendInstance);

    await waitFor(() => expect(screen.getByTestId('claude-spend-mtd')).toBeTruthy());
    expect(source.fetch).toHaveBeenCalledWith({ serviceId: 'anthropic_usage', widgetType: 'spend_mtd', params: {} });
  });
});

describe('SpendMtdCard through the host lifecycle (AOD-59)', () => {
  it('resolves loading -> fresh and renders the MTD amount + a derived run-rate', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: SPEND_MTD_DATA, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    renderHost(source, spendInstance);

    expect(screen.getByTestId('widget-loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('claude-spend-mtd')).toBeTruthy());
    expect(screen.getByTestId('claude-spend-mtd-amount')).toHaveTextContent('$4.00');
    expect(screen.getByText('$2.00/day avg')).toBeTruthy(); // 4 / 2 days
    expect(screen.getByText('2 days this month')).toBeTruthy();
  });

  it('renders a zero-spend org as $0.00 (a valid figure, not an empty/error state, §4.1)', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    const zero: SpendMtdData = { amount: 0, currency: 'USD', windowStart: '2026-06-01', asOf: '2026-06-01', daysElapsed: 0 };
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: zero, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    renderHost(source, spendInstance);

    await waitFor(() => expect(screen.getByTestId('claude-spend-mtd')).toBeTruthy());
    expect(screen.getByTestId('claude-spend-mtd-amount')).toHaveTextContent('$0.00');
  });
});

describe('DailySpendCard through the host lifecycle (AOD-59)', () => {
  it('renders the sparkline and the month-to-date total', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: DAILY_SPEND_DATA, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    renderHost(source, dailyInstance);

    await waitFor(() => expect(screen.getByTestId('claude-daily-spend')).toBeTruthy());
    expect(screen.getByTestId('claude-daily-spend-total')).toHaveTextContent('$4.00');
  });

  it('renders the empty state for a month with no spend yet (never crashes, §4.2)', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { days: [], currency: 'USD', total: 0 }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    renderHost(source, dailyInstance);

    await waitFor(() => expect(screen.getByTestId('claude-daily-spend-empty')).toBeTruthy());
    expect(screen.queryByTestId('claude-daily-spend')).toBeNull();
  });
});
