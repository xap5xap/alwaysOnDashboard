// Component band: the dashboard hub as the AOD-142 EDIT-GUARD shell + the AOD-144 Glance-pager / Arrange
// split. It proves what the SCREEN owns: the Glance | Arrange dial gates which surface shows (in Glance the
// horizontal SkyPager, in Arrange the single active-sky LayoutCanvas), entering Arrange from the viewed page
// sets THAT sky active (so Arrange edits the sky on screen), the Done pill is gone while the wall Preview
// stays (AOD-81), a long-press on a card drops into Arrange for its sky, and the hub chrome sinks on the idle
// timer / wakes on a surface touch. SkyPager + LayoutCanvas are stubbed (their internals — the pager/dots/Pro
// gate, and the placed-card affordances — are tested in their own suites) so these assertions stay about the
// mode shell, not the surfaces it swaps.
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CHROME_IDLE_MS } from '../useChromeAwake';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../../layout/useDashboards', () => ({ useDashboards: jest.fn() }));
jest.mock('../../layout/useRemoveWidget', () => ({ useRemoveWidget: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

// The Glance pager is stubbed to expose the props the shell wires: the active sky + sky count it received,
// a control that fires onPageChange (a swipe), and one that fires onEnterArrange (a long-press on a card).
jest.mock('../SkyPager', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    SkyPager: ({
      dashboards,
      activeId,
      onPageChange,
      onEnterArrange,
    }: {
      dashboards: { id: string }[];
      activeId: string | null;
      onPageChange: (i: number) => void;
      onEnterArrange: (id: string) => void;
    }) =>
      React.createElement(
        View,
        { testID: 'sky-pager' },
        React.createElement(Text, { testID: 'pager-active' }, activeId ?? 'none'),
        React.createElement(Text, { testID: 'pager-count' }, String(dashboards.length)),
        React.createElement(Pressable, { testID: 'pager-swipe-to-1', onPress: () => onPageChange(1) }, React.createElement(Text, null, 'swipe')),
        React.createElement(Pressable, { testID: 'pager-longpress-d2', onPress: () => onEnterArrange('d2') }, React.createElement(Text, null, 'lp')),
      ),
  };
});
// The layout engine (the Arrange surface) is stubbed to expose the `arranging` prop it receives + an
// onEnterArrange trigger (the long-press shortcut). Its real affordance gating is PlacedInstance's concern.
jest.mock('../../layout/LayoutCanvas', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    LayoutCanvas: ({ arranging, onEnterArrange }: { arranging: boolean; onEnterArrange: () => void }) =>
      React.createElement(
        View,
        { testID: 'layout-canvas' },
        React.createElement(Text, { testID: 'canvas-mode' }, arranging ? 'arrange' : 'glance'),
        React.createElement(Pressable, { testID: 'fake-card', onPress: onEnterArrange }, React.createElement(Text, null, 'card')),
      ),
  };
});
// Overlays that only mount from state we never set here — stub them so the hub renders in isolation.
jest.mock('../../layout/WidgetPicker', () => ({ WidgetPicker: () => null }));
jest.mock('../../layout/ConfigureInstanceModal', () => ({ ConfigureInstanceModal: () => null }));
jest.mock('../../kiosk/WallPreview', () => ({ WallPreview: () => null }));
// The cache hand-offs are stubbed so the shell's wiring/ORDER of them is assertable (their real cache copies
// are covered in useSkyInstances.test).
jest.mock('../../layout/useSkyInstances', () => ({
  useSkyInstances: jest.fn(() => ({ instances: [], isLoading: false, isError: false, refetch: jest.fn() })),
  seedSkyFromActive: jest.fn(),
  seedActiveFromSky: jest.fn(),
}));

import { useDashboards } from '../../layout/useDashboards';
import { useRemoveWidget } from '../../layout/useRemoveWidget';
import { seedActiveFromSky } from '../../layout/useSkyInstances';
import { Dashboard } from '../Dashboard';

const mockUseDashboards = useDashboards as jest.Mock;
const mockUseRemoveWidget = useRemoveWidget as jest.Mock;
const mockSeedActiveFromSky = seedActiveFromSky as jest.Mock;

const loaded = (overrides: Record<string, unknown> = {}) => ({
  instances: [{ instanceId: 'i1' }],
  dashboards: [
    { id: 'd1', name: 'Wall', position: 0 },
    { id: 'd2', name: 'Travel', position: 1 },
  ],
  activeId: 'd1',
  dashboardId: 'd1',
  dashboardName: 'Wall',
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  commit: jest.fn(),
  setActive: jest.fn(),
  createDashboard: jest.fn().mockResolvedValue('d3'),
  ...overrides,
});

const canvasMode = () => screen.getByTestId('canvas-mode').props.children;

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDashboards.mockReturnValue(loaded());
  mockUseRemoveWidget.mockReturnValue({ removeWidget: jest.fn() });
});

describe('Dashboard — the Glance-pager / Arrange split §1a/§1e', () => {
  it('Glance is default: renders the sky pager (not the canvas), the dial, the hub actions, and NO Done pill', () => {
    renderDashboard();
    expect(screen.getByTestId('segmented-glance').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('segmented-arrange')).toBeTruthy();
    // Glance shows the pager, not the arrange canvas.
    expect(screen.getByTestId('sky-pager')).toBeTruthy();
    expect(screen.queryByTestId('layout-canvas')).toBeNull();
    // The dial replaced the Done pill; Preview is arrange-only.
    expect(screen.queryByTestId('dashboard-done')).toBeNull();
    expect(screen.queryByTestId('dashboard-preview')).toBeNull();
    // The Glance hub cluster is intact.
    expect(screen.getByTestId('dashboard-add-widget')).toBeTruthy();
    expect(screen.getByTestId('dashboard-settings')).toBeTruthy();
    expect(screen.getByTestId('dashboard-switcher')).toBeTruthy();
  });

  it('passes the ordered skies + the active id into the pager', () => {
    renderDashboard();
    expect(screen.getByTestId('pager-count').props.children).toBe('2');
    expect(screen.getByTestId('pager-active').props.children).toBe('d1');
  });

  it('flipping the dial to Arrange swaps to the active-sky canvas + Preview (never a Done)', () => {
    renderDashboard();
    fireEvent.press(screen.getByTestId('segmented-arrange'));

    expect(screen.getByTestId('layout-canvas')).toBeTruthy();
    expect(canvasMode()).toBe('arrange');
    expect(screen.queryByTestId('sky-pager')).toBeNull(); // the pager yields to the arrange surface
    expect(screen.getByTestId('segmented-arrange').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('dashboard-preview')).toBeTruthy(); // AOD-81 pill kept
    expect(screen.queryByTestId('dashboard-done')).toBeNull(); // never a Done pill
    expect(screen.queryByTestId('dashboard-add-widget')).toBeNull(); // hub actions yield to Preview
  });

  it('entering Arrange sets the VIEWED page sky active (so Arrange edits the sky on screen)', () => {
    const setActive = jest.fn();
    mockUseDashboards.mockReturnValue(loaded({ setActive }));
    renderDashboard();

    // Swipe to page 1 (sky d2), THEN flip the dial: Arrange must operate on d2, not the default d1.
    fireEvent.press(screen.getByTestId('pager-swipe-to-1'));
    fireEvent.press(screen.getByTestId('segmented-arrange'));

    expect(setActive).toHaveBeenCalledWith('d2');
    expect(canvasMode()).toBe('arrange');
  });

  it('entering Arrange on the already-active sky does NOT redundantly re-activate it (no reload)', () => {
    const setActive = jest.fn();
    mockUseDashboards.mockReturnValue(loaded({ setActive })); // activeId 'd1', currentPage defaults to 0 -> d1
    renderDashboard();

    fireEvent.press(screen.getByTestId('segmented-arrange'));
    expect(canvasMode()).toBe('arrange'); // arrange is entered
    expect(setActive).not.toHaveBeenCalled(); // ...but d1 is already active, so no invalidate/refetch
    expect(mockSeedActiveFromSky).not.toHaveBeenCalled(); // ...and no hand-off (['dashboard'] already holds d1)
  });

  it('entering Arrange on a swiped-to sky seeds the active cache from that sky BEFORE setActive (paints it at once)', () => {
    const setActive = jest.fn();
    mockUseDashboards.mockReturnValue(loaded({ setActive }));
    renderDashboard();

    // Swipe to page 1 (d2, not the active d1), THEN flip the dial to Arrange.
    fireEvent.press(screen.getByTestId('pager-swipe-to-1'));
    fireEvent.press(screen.getByTestId('segmented-arrange'));

    // ['dashboard'] is seeded with d2 BEFORE setActive fires its lagging refetch, so Arrange paints d2 (not
    // the previously-active d1) from frame one and a commit in that window can't persist to the wrong sky.
    expect(mockSeedActiveFromSky).toHaveBeenCalledWith(expect.anything(), 'u1', 'd2');
    expect(setActive).toHaveBeenCalledWith('d2');
    const seedOrder = mockSeedActiveFromSky.mock.invocationCallOrder[0];
    const setActiveOrder = setActive.mock.invocationCallOrder[0];
    expect(seedOrder).toBeLessThan(setActiveOrder);
  });

  it('flipping the dial back to Glance leaves arrange and returns to the pager', () => {
    renderDashboard();
    fireEvent.press(screen.getByTestId('segmented-arrange'));
    expect(canvasMode()).toBe('arrange');

    fireEvent.press(screen.getByTestId('segmented-glance'));
    expect(screen.getByTestId('sky-pager')).toBeTruthy();
    expect(screen.queryByTestId('layout-canvas')).toBeNull();
    expect(screen.queryByTestId('dashboard-preview')).toBeNull();
    expect(screen.getByTestId('dashboard-add-widget')).toBeTruthy();
  });

  it('long-pressing a card on a page drops into Arrange for THAT sky (the shortcut is kept)', () => {
    const setActive = jest.fn();
    mockUseDashboards.mockReturnValue(loaded({ setActive }));
    renderDashboard();
    expect(screen.getByTestId('sky-pager')).toBeTruthy();

    fireEvent.press(screen.getByTestId('pager-longpress-d2')); // the stubbed long-press -> onEnterArrange('d2')
    expect(setActive).toHaveBeenCalledWith('d2');
    expect(canvasMode()).toBe('arrange');
    expect(screen.getByTestId('segmented-arrange').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('sinks the dial after the idle window and wakes it on a surface touch', () => {
    jest.useFakeTimers();
    try {
      renderDashboard();
      // Awake on mount -> interactive.
      expect(screen.getByTestId('mode-dial').props.pointerEvents).toBe('auto');

      // Idle past the window -> sunk (non-interactive AND a11y-hidden), so a waking touch can't also flip the
      // mode; opt into hidden elements since the sunk dial is intentionally dropped from the a11y tree.
      act(() => {
        jest.advanceTimersByTime(CHROME_IDLE_MS);
      });
      expect(screen.getByTestId('mode-dial', { includeHiddenElements: true }).props.pointerEvents).toBe('none');

      // A touch anywhere on the surface wakes it again.
      fireEvent(screen.getByTestId('dashboard-surface'), 'touchStart', { nativeEvent: {} });
      expect(screen.getByTestId('mode-dial').props.pointerEvents).toBe('auto');
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides the dial (and Add) while the board loads — nothing to arrange yet; Settings stays', () => {
    mockUseDashboards.mockReturnValue(loaded({ isLoading: true, instances: [], dashboards: [] }));
    renderDashboard();
    expect(screen.queryByTestId('mode-dial')).toBeNull();
    expect(screen.queryByTestId('dashboard-add-widget')).toBeNull();
    expect(screen.queryByTestId('sky-pager')).toBeNull();
    expect(screen.getByTestId('dashboard-settings')).toBeTruthy();
    expect(screen.getByTestId('screen-loading')).toBeTruthy();
  });

  it('shows the shell error state with a Retry that refetches', () => {
    const refetch = jest.fn();
    mockUseDashboards.mockReturnValue(loaded({ isError: true, error: new Error('nope'), refetch }));
    renderDashboard();
    expect(screen.getByTestId('screen-error')).toBeTruthy();
    expect(screen.queryByTestId('sky-pager')).toBeNull();
    fireEvent.press(screen.getByTestId('screen-error-retry'));
    expect(refetch).toHaveBeenCalled();
  });
});
