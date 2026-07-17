// SpendMtdCard + DailySpendCard driven through the real WidgetHost + the registry + TanStack Query + a
// mock WidgetDataSource (testing-strategy §9, mirroring services/weather/__tests__/WeatherCards.test.tsx).
// It also pins the admin_key host params behavior (integration-claude.md §6.3): unlike platform_key
// (Weather), an admin_key service is zero-config and takes the host's UNCHANGED else-branch, so the proxy
// params are instance.config (empty) and connection.config is NOT merged in. The cents->dollars /100 lives
// server-side (operations.ts); the card receives an already-normalized payload, so these assert rendering.
//
// AOD-36 polish (design-claude-usage.md): the Spend MTD run-rate is W-only (§5 layout); $0.00 is a
// valid hero, NOT the EmptyBody (§5.3); Daily Spend draws the sparkline at W/L with an L-only
// today label, and an empty days[] is the §5.1 EmptyBody (§6.2).
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import { SpendMtdCard } from '../SpendMtdCard';
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
  size: 'S', // AOD-122 slot id (was 'small')
  rect: { x: 0, y: 0, w: 1, h: 1, z: 0 },
};

const wSpendInstance: WidgetInstance = {
  ...spendInstance,
  instanceId: 'au-spend-md',
  size: 'W', // AOD-122 slot id (was 'medium'; same 2x1 rect)
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

const dailyInstance: WidgetInstance = {
  instanceId: 'au-daily',
  serviceId: 'anthropic_usage',
  widgetType: 'daily_spend',
  config: {},
  size: 'W', // AOD-122: the banner slot (was the retired wide 3x1; W is 2x1)
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

const largeDailyInstance: WidgetInstance = {
  ...dailyInstance,
  instanceId: 'au-daily-lg',
  size: 'L', // AOD-122 slot id (was 'large')
  rect: { x: 0, y: 0, w: 2, h: 2, z: 0 },
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
    { date: '2026-06-02', amount: 2.5 }, // the rightmost is today -> "today $2.50" at L
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

function spendSource(data: SpendMtdData): WidgetDataSource {
  return {
    fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
    resolveOptions: jest.fn().mockResolvedValue([]),
  };
}

function dailySource(data: DailySpendData): WidgetDataSource {
  return {
    fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
    resolveOptions: jest.fn().mockResolvedValue([]),
  };
}

beforeEach(() => {
  mockConnections = new Map();
});

describe('admin_key host params (integration-claude.md §6.3): the host else-branch, no params-seeding', () => {
  it('sends params = instance.config (empty), NOT connection.config, for an admin_key (claude) widget', async () => {
    // The connection carries config; admin_key is NOT platform_key, so the host takes the else-branch and
    // the zero-config instance config ({}) flows through unchanged. This proves WidgetHost is untouched.
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', { ignored: 'conn-config' })]]);
    const source = spendSource(SPEND_MTD_DATA);
    renderHost(source, spendInstance);

    await waitFor(() => expect(screen.getByTestId('claude-spend-mtd')).toBeTruthy());
    expect(source.fetch).toHaveBeenCalledWith({ serviceId: 'anthropic_usage', widgetType: 'spend_mtd', params: {} });
  });
});

describe('SpendMtdCard through the host lifecycle (AOD-59 + AOD-36 polish)', () => {
  // AOD-123: Spend MTD migrated onto the shared FitBody. Both the slots it ships (S 1x1, W 2x1) are one
  // unit tall (~48px body), where the type.xl value already fills the height, so the run-rate SHEDS rather
  // than clipping under the card — the AOD-95/97 fix (was: the run-rate was in the tree but chopped by the
  // card's overflow:hidden). The run-rate's content is covered by the tall-box render below; it reappears
  // automatically on any taller slot the widget gains.
  it('at W renders the MTD amount; the run-rate sheds on the 1-unit body (AOD-123 fit-to-bounds)', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    renderHost(spendSource(SPEND_MTD_DATA), wSpendInstance);

    expect(screen.getByTestId('widget-loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('claude-spend-mtd')).toBeTruthy());
    expect(screen.getByTestId('claude-spend-mtd-amount')).toHaveTextContent('$4.00');
    expect(screen.queryByTestId('claude-spend-mtd-runrate')).toBeNull();
  });

  it('at S renders the amount but suppresses the run-rate (the 1x1 glance, §5 layout)', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    renderHost(spendSource(SPEND_MTD_DATA), spendInstance); // S

    await waitFor(() => expect(screen.getByTestId('claude-spend-mtd')).toBeTruthy());
    expect(screen.getByTestId('claude-spend-mtd-amount')).toHaveTextContent('$4.00');
    expect(screen.queryByTestId('claude-spend-mtd-runrate')).toBeNull();
  });

  it('seats the run-rate when the box has the HEIGHT for it (§5.2 content preserved through the migration)', () => {
    // A direct render with a 2-unit-tall box: the run-rate line is declared unconditionally, so FitBody
    // seats it (with its $/day + day-count content) whenever there is vertical room — proving the migration
    // did not drop the §5.2 feature, only its seat on the too-short 1-unit slots.
    render(<SpendMtdCard data={SPEND_MTD_DATA} config={{}} size="W" box={{ width: 168, height: 144 }} />);
    const runRate = screen.getByTestId('claude-spend-mtd-runrate');
    expect(runRate).toHaveTextContent(/\$2\.00\/day avg/); // 4 / 2 days
    expect(runRate).toHaveTextContent(/2 days this month/);
  });

  it('renders a zero-spend org as the $0.00 hero (a valid figure, NOT the empty body, §5.3)', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    const zero: SpendMtdData = { amount: 0, currency: 'USD', windowStart: '2026-06-01', asOf: '2026-06-12', daysElapsed: 12 };
    renderHost(spendSource(zero), wSpendInstance);

    await waitFor(() => expect(screen.getByTestId('claude-spend-mtd')).toBeTruthy());
    expect(screen.getByTestId('claude-spend-mtd-amount')).toHaveTextContent('$0.00');
    // $0.00 is the hero (a valid figure), NOT routed through the calm empty body Daily Spend uses.
    expect(screen.queryByTestId('widget-empty-body')).toBeNull();
  });
});

describe('DailySpendCard through the host lifecycle (AOD-59 + AOD-36 polish)', () => {
  it('at W renders the sparkline + the MTD total, no L-only today label', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    renderHost(dailySource(DAILY_SPEND_DATA), dailyInstance);

    await waitFor(() => expect(screen.getByTestId('claude-daily-spend')).toBeTruthy());
    expect(screen.getByTestId('claude-daily-spend-total')).toHaveTextContent('$4.00');
    expect(screen.getByTestId('claude-sparkline')).toBeTruthy();
    expect(screen.queryByTestId('claude-daily-spend-today')).toBeNull(); // today label is L-only (§6.1)
  });

  it('at L adds the "today $X.XX" value label over the today bar (§6.1)', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    renderHost(dailySource(DAILY_SPEND_DATA), largeDailyInstance);

    await waitFor(() => expect(screen.getByTestId('claude-daily-spend')).toBeTruthy());
    expect(screen.getByTestId('claude-sparkline')).toBeTruthy();
    expect(screen.getByTestId('claude-daily-spend-today')).toHaveTextContent('today $2.50'); // last day's amount
  });

  it('renders the §5.1 empty body for a month with no spend yet (never crashes, §6.2)', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    renderHost(dailySource({ days: [], currency: 'USD', total: 0 }), dailyInstance);

    await waitFor(() => expect(screen.getByTestId('claude-daily-spend-empty')).toBeTruthy());
    expect(screen.getByTestId('widget-empty-body')).toBeTruthy(); // the shared EmptyBody convention
    expect(screen.queryByTestId('claude-daily-spend')).toBeNull();
  });
});

// The de-duplicated SERVICE · WIDGET caption (the AOD-64 header follow-up). The host owns the quiet
// "SERVICE · WIDGET" caption (WidgetHostView §4.2), composing it from the service displayName ("Claude
// usage") and the widget title. The titles are bare nouns ("Spend (MTD)" / "Daily Spend"), like every
// sibling widget (Weather "Forecast", Linear "My Issues", Calendar "Next Event"), so the brand is NOT
// printed twice. Regression guard: it used to read "Claude usage · Claude Spend (MTD)".
describe('the host caption is de-duplicated (the SERVICE · WIDGET header convention)', () => {
  it('Spend MTD reads "Claude usage · Spend (MTD)", not a doubled "Claude"', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    renderHost(spendSource(SPEND_MTD_DATA), wSpendInstance);

    await waitFor(() => expect(screen.getByTestId('claude-spend-mtd')).toBeTruthy());
    expect(screen.getByText('Claude usage · Spend (MTD)')).toBeTruthy();
    expect(screen.queryByText('Claude usage · Claude Spend (MTD)')).toBeNull();
  });

  it('Daily Spend reads "Claude usage · Daily Spend", not a doubled "Claude"', async () => {
    mockConnections = new Map([['anthropic_usage', connection('anthropic_usage', 'admin_key', {})]]);
    renderHost(dailySource(DAILY_SPEND_DATA), dailyInstance);

    await waitFor(() => expect(screen.getByTestId('claude-daily-spend')).toBeTruthy());
    expect(screen.getByText('Claude usage · Daily Spend')).toBeTruthy();
    expect(screen.queryByText('Claude usage · Claude Daily Spend')).toBeNull();
  });
});
