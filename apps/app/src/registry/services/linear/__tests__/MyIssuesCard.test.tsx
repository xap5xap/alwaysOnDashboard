// MyIssuesCard driven through the real WidgetHost + the registry + TanStack Query + a mock
// WidgetDataSource (testing-strategy §9, mirroring host/__tests__/WidgetHost.test.tsx). Proves the
// Linear my_issues path end to end on the client: connecting -> live renders the issues, the host-drawn
// empty phase (AOD-125), the 409 -> disconnected mapping, and the AOD-10 §4.4 render-time projectId re-check.
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import type { WidgetInstance } from '../../../types';
import type { MyIssue, MyIssuesData } from '../MyIssuesCard';
import { darkTheme } from '../../../../../unistyles';

// The host reads useConnections() for the generic platform_key params-seeding (integration-weather.md
// §6.3). linear is oauth2, so seeding is a no-op (params = instance.config); stub the hook so the host
// needs no AuthProvider/supabase here.
jest.mock('../../../../connections/useConnections', () => ({
  useConnections: () => ({ connections: new Map(), isLoading: false, isError: false, error: null }),
}));

const baseInstance: WidgetInstance = {
  instanceId: 'li1',
  serviceId: 'linear',
  widgetType: 'my_issues',
  config: { projectId: 'p1', filter: 'open' },
  size: 'W', // AOD-122 slot id (was 'medium')
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

const largeInstance: WidgetInstance = { ...baseInstance, instanceId: 'li-lg', size: 'L', rect: { x: 0, y: 0, w: 2, h: 2, z: 0 } };

// The projectId picker resolves through the same seam; p1 is a member so the config validates.
const projectChoices = [{ value: 'p1', label: 'Platform & App Shell' }];

const sampleData: MyIssuesData = {
  issues: [
    { id: 'i1', identifier: 'AOD-55', title: 'Wire Linear My Issues', url: 'u1', stateName: 'In Progress', stateType: 'started', priority: 2, priorityLabel: 'High', dueDate: null },
    { id: 'i2', identifier: 'AOD-30', title: 'Linear widget visual design', url: 'u2', stateName: 'Todo', stateType: 'unstarted', priority: 3, priorityLabel: 'Medium', dueDate: null },
  ],
  totalCount: 2,
};

function renderHost(
  source: WidgetDataSource,
  config: Record<string, unknown> = baseInstance.config,
  instance: WidgetInstance = baseInstance,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RegistryProvider>
        <WidgetDataSourceProvider source={source}>
          <WidgetHost instance={{ ...instance, config }} maxRetries={0} />
        </WidgetDataSourceProvider>
      </RegistryProvider>
    </QueryClientProvider>,
  );
}

describe('Linear My Issues through the host lifecycle (AOD-55)', () => {
  it('resolves loading -> fresh and renders the assigned issues with the configured params', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: sampleData, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices),
    };
    // AOD-123: rendered at L (2x2) where the rows fit — the visible count is now height-driven, so the
    // short W cell (48px) leads with the count and sheds the rows into "+N more" rather than overflowing.
    renderHost(source, baseInstance.config, largeInstance);

    expect(screen.getByTestId('widget-connecting')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('linear-myissues')).toBeTruthy());
    expect(screen.getByText('AOD-55')).toBeTruthy();
    expect(screen.getByText('Wire Linear My Issues')).toBeTruthy();
    // AOD-30 §5.1: the body leads with the assigned count, the qualifier echoing the active filter.
    expect(screen.getByTestId('linear-myissues-count')).toHaveTextContent('2 open');
    expect(source.fetch).toHaveBeenCalledWith({
      serviceId: 'linear',
      widgetType: 'my_issues',
      params: { projectId: 'p1', filter: 'open' },
    });
  });

  it('at W leads with the count over the worded priority summary — no rows, no "+N more" (AOD-134)', async () => {
    // W (2x1) is the count + summary banner: the worded histogram carries priority where there are no rows,
    // so there are no issue rows and no "+N more" here. sampleData is 1 High + 1 Medium.
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: sampleData, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices),
    };
    renderHost(source); // W (baseInstance)
    await waitFor(() => expect(screen.getByTestId('linear-myissues')).toBeTruthy());
    expect(screen.getByTestId('linear-myissues-count')).toHaveTextContent('2 open'); // the value leads
    expect(screen.getByTestId('linear-myissues-summary')).toHaveTextContent('1 High · 1 Med'); // heavy→light
    expect(screen.queryByTestId('linear-myissues-rowglyph')).toBeNull(); // W shows no rows
    expect(screen.queryByText('Wire Linear My Issues')).toBeNull();
    expect(screen.queryByTestId('linear-myissues-more')).toBeNull();
  });

  it('resolves to the host-drawn empty phase when there are no assigned issues (AOD-125)', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { issues: [], totalCount: 0 }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices),
    };
    renderHost(source);
    // AOD-125: totalCount 0 is now the host-drawn `empty` phase (isMyIssuesEmpty), drawn as the shared
    // EmptyBody ("Nothing right now."); the leaf no longer self-draws its own empty body.
    await waitFor(() => expect(screen.getByTestId('widget-empty-body')).toBeTruthy());
    expect(screen.getByText('Nothing right now.')).toBeTruthy();
    expect(screen.queryByTestId('linear-myissues')).toBeNull();
  });

  it('maps a needs_reconnect proxy error (409) to the disconnected state, no card', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockRejectedValue({ kind: 'needs_reconnect' }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices),
    };
    renderHost(source);
    await waitFor(() => expect(screen.getByTestId('widget-disconnected')).toBeTruthy());
    expect(screen.queryByTestId('linear-myissues')).toBeNull();
  });

  it('surfaces needs_config when the stored projectId is no longer a member (AOD-10 §4.4)', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: sampleData, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices), // only p1; the stored 'ghost' is gone
    };
    renderHost(source, { projectId: 'ghost', filter: 'open' });
    await screen.findByTestId('widget-needs-config');
    expect(screen.queryByTestId('linear-myissues')).toBeNull();
  });

  it('echoes the active filter in the count qualifier (open / in progress / all, §5.1)', async () => {
    const mk = (): WidgetDataSource => ({
      fetch: jest.fn().mockResolvedValue({ data: sampleData, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices),
    });
    const first = renderHost(mk(), { projectId: 'p1', filter: 'in_progress' });
    await waitFor(() => expect(screen.getByTestId('linear-myissues-count')).toHaveTextContent('2 in progress'));
    first.unmount();
    renderHost(mk(), { projectId: 'p1', filter: 'all' });
    await waitFor(() => expect(screen.getByTestId('linear-myissues-count')).toHaveTextContent('2 assigned'));
  });

  it('shows the due date on the right at L, omits it at W (the §5.2 L affordance)', async () => {
    const dueData: MyIssuesData = {
      issues: [
        { id: 'd1', identifier: 'AOD-30', title: 'Linear widget visuals', url: 'u', stateName: 'In Progress', stateType: 'started', priority: 1, priorityLabel: 'Urgent', dueDate: '2026-12-31' },
      ],
      totalCount: 1,
    };
    const mk = (): WidgetDataSource => ({
      fetch: jest.fn().mockResolvedValue({ data: dueData, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices),
    });

    const lg = renderHost(mk(), largeInstance.config, largeInstance);
    await waitFor(() => expect(screen.getByTestId('linear-myissues')).toBeTruthy());
    expect(screen.getByTestId('linear-myissues-due')).toBeTruthy();
    lg.unmount();

    renderHost(mk()); // W
    await waitFor(() => expect(screen.getByTestId('linear-myissues')).toBeTruthy());
    expect(screen.queryByTestId('linear-myissues-due')).toBeNull();
  });
});

// --- AOD-134 Soundings: inline row glyphs + the worded summary, the S/M/W/L layouts, overdue-vs-Today due ----
const sInstance: WidgetInstance = { ...baseInstance, instanceId: 'li-s', size: 'S', rect: { x: 0, y: 0, w: 1, h: 1, z: 0 } };
const mInstance: WidgetInstance = { ...baseInstance, instanceId: 'li-m', size: 'M', rect: { x: 0, y: 0, w: 1, h: 2, z: 0 } };

const PRIORITY_LABEL: Record<number, string> = { 0: 'No priority', 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low' };
const issue = (id: string, priority: number, extra: Partial<MyIssue> = {}): MyIssue => ({
  id,
  identifier: `AOD-${id}`,
  title: `Issue ${id}`,
  url: 'u',
  stateName: 'Todo',
  stateType: 'unstarted',
  priority,
  priorityLabel: PRIORITY_LABEL[priority] ?? 'No priority',
  dueDate: null,
  ...extra,
});
const sourceFor = (data: MyIssuesData): WidgetDataSource => ({
  fetch: jest.fn().mockResolvedValue({ data, fetchedAt: Date.now() }),
  resolveOptions: jest.fn().mockResolvedValue(projectChoices),
});
function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

describe('Soundings inline glyphs + worded summary + S/M/W/L layouts (AOD-134)', () => {
  it('at S is the glance: the count over the worded summary, no rows', async () => {
    renderHost(sourceFor(sampleData), baseInstance.config, sInstance);
    await waitFor(() => expect(screen.getByTestId('linear-myissues')).toBeTruthy());
    expect(screen.getByTestId('linear-myissues-count')).toHaveTextContent('2 open');
    expect(screen.getByTestId('linear-myissues-summary')).toHaveTextContent('1 High · 1 Med');
    expect(screen.queryByTestId('linear-myissues-rowglyph')).toBeNull(); // S shows no rows
    expect(screen.queryByText('Wire Linear My Issues')).toBeNull();
    expect(screen.queryByTestId('linear-myissues-more')).toBeNull();
  });

  it('at M is the reading size: count over glyph · title rows (id dropped), and NO worded summary', async () => {
    renderHost(sourceFor(sampleData), baseInstance.config, mInstance);
    await waitFor(() => expect(screen.getByTestId('linear-myissues')).toBeTruthy());
    expect(screen.getByTestId('linear-myissues-count')).toHaveTextContent('2 open');
    // M is the one size with NO worded summary — the inline row glyphs carry priority instead (one per row)
    expect(screen.queryByTestId('linear-myissues-summary')).toBeNull();
    expect(screen.getAllByTestId('linear-myissues-rowglyph')).toHaveLength(2);
    expect(screen.getByText('Wire Linear My Issues')).toBeTruthy(); // the title reads
    expect(screen.queryByText('AOD-55')).toBeNull(); // the identifier is an L affordance (the narrow M drops it)
  });

  it('at L carries BOTH the worded summary and the glyph rows (count + summary + inline-glyph rows)', async () => {
    renderHost(sourceFor(sampleData), largeInstance.config, largeInstance);
    await waitFor(() => expect(screen.getByTestId('linear-myissues')).toBeTruthy());
    expect(screen.getByTestId('linear-myissues-count')).toHaveTextContent('2 open');
    expect(screen.getByTestId('linear-myissues-summary')).toHaveTextContent('1 High · 1 Med');
    expect(screen.getAllByTestId('linear-myissues-rowglyph')).toHaveLength(2); // one inline glyph per row
    expect(screen.getByText('AOD-55')).toBeTruthy(); // rows present alongside the summary
  });

  it('the worded summary tallies ALL issues heavy→light (never capped); the rows stay source order (AOD-134)', async () => {
    // 12 issues, source order deliberately NOT heavy→light: [low×3, med×2, none×2, high×2, urgent×2, none].
    const many: MyIssuesData = {
      issues: [
        issue('a', 4), issue('b', 4), issue('c', 4), issue('d', 3), issue('e', 3), issue('f', 0),
        issue('g', 0), issue('h', 2), issue('i', 2), issue('j', 1), issue('k', 1), issue('l', 0),
      ],
      totalCount: 12,
    };
    renderHost(sourceFor(many), largeInstance.config, largeInstance);
    await waitFor(() => expect(screen.getByTestId('linear-myissues')).toBeTruthy());
    // the summary is the WHOLE tally in heavy→light order (urgent 2, high 2, med 2, low 3, none 3) — not capped
    expect(screen.getByTestId('linear-myissues-summary')).toHaveTextContent('2 Urgent · 2 High · 2 Med · 3 Low · 3 None');
    expect(screen.getByTestId('linear-myissues-count')).toHaveTextContent('12 open'); // the count carries the total
    // the rows keep SOURCE order (only the summary is ordered): the first visible row is issue 'a' = Low
    const rowGlyphs = screen.getAllByTestId('linear-myissues-rowglyph');
    expect(rowGlyphs.length).toBeGreaterThanOrEqual(1);
    expect(rowGlyphs[0].props.accessibilityLabel).toBe('Low'); // issue 'a' (priority 4), not the sorted-first Urgent
  });

  it('warms the due ONLY on a breach: overdue → warning ink, Today → text, future → muted (L, §5.2)', async () => {
    const dueData: MyIssuesData = {
      issues: [
        issue('over', 1, { dueDate: '2020-01-01' }), // long overdue
        issue('today', 2, { dueDate: todayYmd() }), // due today
        issue('future', 3, { dueDate: '2099-12-31' }), // far future
      ],
      totalCount: 3,
    };
    renderHost(sourceFor(dueData), largeInstance.config, largeInstance);
    await waitFor(() => expect(screen.getByTestId('linear-myissues')).toBeTruthy());
    const dues = screen.getAllByTestId('linear-myissues-due'); // rows render in source order
    expect(dues).toHaveLength(3);
    const colorOf = (i: number) => StyleSheet.flatten(dues[i].props.style).color;
    expect(colorOf(0)).toBe(darkTheme.colors.warning); // overdue → the one amber status ink (the breach)
    expect(colorOf(1)).toBe(darkTheme.colors.text); // Today → bone-bright
    expect(colorOf(2)).toBe(darkTheme.colors.textMuted); // future → recedes
    // the accent is never spent (My Issues is deliberately monochrome): no due wears colors.accent
    expect([colorOf(0), colorOf(1), colorOf(2)]).not.toContain(darkTheme.colors.accent);
    expect(new Set([colorOf(0), colorOf(1), colorOf(2)]).size).toBe(3); // the three tones are distinct
  });
});
