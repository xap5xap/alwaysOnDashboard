// Component band: the dashboard hub as the AOD-142 edit-mode SEPARATION + the AOD-144 Glance-pager / Arrange
// split, now entered through the AOD-195 long-press quick-actions menu (the mode dial is retired). It proves
// what the SCREEN owns: calm is the wordless default (pager, Add + Settings, NO dial, NO Done); a long-press on
// a card opens the anchored menu; the menu's items route to the EXISTING actions (Edit Widget -> the config
// sheet, Edit Screen -> Arrange, Delete -> the calm tile-face confirm, the S/M/W/L row -> a commit); Edit
// Screen shows Done (which exits + hands the layout back); a long-press on an empty sky enters Edit Screen; and
// the chrome sinks/wakes on the idle timer. SkyPager, LayoutCanvas, and CardQuickActions are stubbed (their
// internals have their own suites) so these assertions stay about the mode shell, not the surfaces it swaps.
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CHROME_IDLE_MS } from '../useChromeAwake';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../../layout/useDashboards', () => ({ useDashboards: jest.fn() }));
jest.mock('../../layout/useRemoveWidget', () => ({ useRemoveWidget: jest.fn() }));
jest.mock('../../layout/useMoveInstance', () => ({ useMoveInstance: jest.fn(() => ({ moveInstance: jest.fn() })) }));
// AOD-197: pin the device orientation so the shell's per-orientation wiring (useDashboards(orientation) + the
// seed hand-offs, which now carry the orientation) is deterministic — landscape, the wall's orientation.
jest.mock('../../layout/useOrientation', () => ({ useOrientation: () => 'landscape' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

// The Glance pager is stubbed to expose the props the shell wires: the active sky + count, a swipe, a card
// long-press (AOD-195 -> onLongPressCard, per sky), an empty-sky long-press (-> onEnterArrange), the threaded
// menu-confirm id, and the chrome-awake state (drives the dots/capsule now the dial is gone).
jest.mock('../SkyPager', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    SkyPager: ({
      dashboards,
      activeId,
      activeInstances,
      awake,
      confirmingRemoveId,
      onPageChange,
      onEnterArrange,
      onLongPressCard,
    }: {
      dashboards: { id: string }[];
      activeId: string | null;
      activeInstances: { instanceId: string }[];
      awake: boolean;
      confirmingRemoveId: string | null;
      onPageChange: (i: number) => void;
      onEnterArrange: (id: string) => void;
      onLongPressCard: (skyId: string, instance: { instanceId: string }, anchor: { x: number; y: number }) => void;
    }) =>
      React.createElement(
        View,
        { testID: 'sky-pager' },
        React.createElement(Text, { testID: 'pager-active' }, activeId ?? 'none'),
        React.createElement(Text, { testID: 'pager-count' }, String(dashboards.length)),
        React.createElement(Text, { testID: 'pager-active-instances' }, activeInstances.map((i) => i.instanceId).join(',')),
        React.createElement(Text, { testID: 'pager-confirming' }, confirmingRemoveId ?? 'none'),
        React.createElement(Text, { testID: 'pager-awake' }, awake ? 'awake' : 'sunk'),
        React.createElement(Pressable, { testID: 'pager-swipe-to-1', onPress: () => onPageChange(1) }, React.createElement(Text, null, 'swipe')),
        // A long-press on a card on page d1 (active) / d2 (non-active) -> open the quick-actions menu for i1.
        React.createElement(Pressable, { testID: 'pager-longpress-d1', onPress: () => onLongPressCard('d1', { instanceId: 'i1' }, { x: 10, y: 20 }) }, React.createElement(Text, null, 'lp1')),
        React.createElement(Pressable, { testID: 'pager-longpress-d2', onPress: () => onLongPressCard('d2', { instanceId: 'i1' }, { x: 10, y: 20 }) }, React.createElement(Text, null, 'lp2')),
        // A long-press on an EMPTY sky d2 -> enter Edit Screen directly (no card to hold).
        React.createElement(Pressable, { testID: 'pager-empty-longpress-d2', onPress: () => onEnterArrange('d2') }, React.createElement(Text, null, 'elp')),
      ),
  };
});
// The layout engine (the Arrange surface) is stubbed to expose the `arranging` prop it receives + an
// onEnterArrange trigger. Its real affordance gating is PlacedInstance's concern.
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
// The quick-actions menu is stubbed to expose its item triggers + the instance it received, so the shell's
// wiring (which action each item routes to) is assertable without CardQuickActions' registry lookup.
jest.mock('../CardQuickActions', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    CardQuickActions: ({
      instance,
      onEditWidget,
      onEditScreen,
      onDeleteWidget,
      onSelectSize,
      onDismiss,
    }: {
      instance: { instanceId: string; size: string };
      onEditWidget: () => void;
      onEditScreen: () => void;
      onDeleteWidget: () => void;
      onSelectSize: (s: string) => void;
      onDismiss: () => void;
    }) =>
      React.createElement(
        View,
        { testID: 'card-quick-actions' },
        React.createElement(Text, { testID: 'menu-instance' }, instance.instanceId),
        React.createElement(Text, { testID: 'menu-size' }, instance.size),
        React.createElement(Pressable, { testID: 'menu-edit-widget', onPress: onEditWidget }, React.createElement(Text, null, 'ew')),
        React.createElement(Pressable, { testID: 'menu-edit-screen', onPress: onEditScreen }, React.createElement(Text, null, 'es')),
        React.createElement(Pressable, { testID: 'menu-delete', onPress: onDeleteWidget }, React.createElement(Text, null, 'del')),
        React.createElement(Pressable, { testID: 'menu-size-L', onPress: () => onSelectSize('L') }, React.createElement(Text, null, 'L')),
        React.createElement(Pressable, { testID: 'menu-dismiss', onPress: onDismiss }, React.createElement(Text, null, 'x')),
      ),
  };
});
// The config sheet is stubbed to a marker so "Edit Widget opens OUR ConfigureInstanceModal (not an inline
// flip)" is assertable by the instance it received.
jest.mock('../../layout/ConfigureInstanceModal', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { ConfigureInstanceModal: ({ instance }: { instance: { instanceId: string } }) => React.createElement(Text, { testID: 'config-modal' }, instance.instanceId) };
});
jest.mock('../../layout/AddGallery', () => ({ AddGallery: () => null }));
jest.mock('../../kiosk/WallPreview', () => ({ WallPreview: () => null }));
// gesture-handler: the AOD-145 pinch-in wrapper on the card-altitude surface. Passthrough — GestureDetector
// renders its child; the pinch is device-only (AOD-190), so the capsule press is the entry these tests drive.
jest.mock('react-native-gesture-handler', () => {
  const make = () => {
    const g: Record<string, () => unknown> = {};
    ['enabled', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'onBegin', 'onChange', 'minDuration', 'activateAfterLongPress', 'scaleTo'].forEach((m) => {
      g[m] = () => g;
    });
    return g;
  };
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pinch: make, Pan: make, LongPress: make },
  };
});
// AOD-145 page altitude is stubbed to expose the props the shell wires (the ordered skies + active id, and a
// tap-to-descend). Its real internals are tested in PageAltitude's own suite.
jest.mock('../PageAltitude', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    PageAltitude: ({
      dashboards,
      activeId,
      onTapSky,
    }: {
      dashboards: { id: string }[];
      activeId: string | null;
      onTapSky: (id: string) => void;
    }) =>
      React.createElement(
        View,
        { testID: 'page-altitude' },
        React.createElement(Text, { testID: 'pa-active' }, activeId ?? 'none'),
        React.createElement(Text, { testID: 'pa-count' }, String(dashboards.length)),
        React.createElement(Pressable, { testID: 'pa-tap-d2', onPress: () => onTapSky('d2') }, React.createElement(Text, null, 'tap')),
      ),
  };
});
// The cache hand-offs are stubbed so the shell's wiring/ORDER of them is assertable (their real cache copies
// are covered in useSkyInstances.test).
jest.mock('../../layout/useSkyInstances', () => ({
  useSkyInstances: jest.fn(() => ({ instances: [], isLoading: false, isError: false, refetch: jest.fn() })),
  seedSkyFromActive: jest.fn(),
  seedActiveFromSky: jest.fn(),
}));

import { useDashboards } from '../../layout/useDashboards';
import { useRemoveWidget } from '../../layout/useRemoveWidget';
import { seedActiveFromSky, seedSkyFromActive } from '../../layout/useSkyInstances';
import { Dashboard } from '../Dashboard';
import type { WidgetInstance } from '../../registry/types';

const mockUseDashboards = useDashboards as jest.Mock;
const mockUseRemoveWidget = useRemoveWidget as jest.Mock;
const mockSeedActiveFromSky = seedActiveFromSky as jest.Mock;
const mockSeedSkyFromActive = seedSkyFromActive as jest.Mock;

// A full WidgetInstance so the menu's size re-snap (which reads .rect / .size) has real geometry.
const card = (instanceId: string, rect: WidgetInstance['rect'], size: WidgetInstance['size'] = 'S'): WidgetInstance => ({
  instanceId,
  serviceId: 's',
  widgetType: 'w',
  config: {},
  rect,
  size,
});

const loaded = (overrides: Record<string, unknown> = {}) => ({
  instances: [card('i1', { x: 0, y: 0, w: 1, h: 1, z: 0 })],
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
  renameDashboard: jest.fn(),
  reorderDashboards: jest.fn(),
  deleteDashboard: jest.fn(),
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

// Enter Edit Screen the new way: long-press the active sky's card -> the menu -> Edit Screen.
const enterArrangeViaMenu = () => {
  fireEvent.press(screen.getByTestId('pager-longpress-d1'));
  fireEvent.press(screen.getByTestId('menu-edit-screen'));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDashboards.mockReturnValue(loaded());
  mockUseRemoveWidget.mockReturnValue({ removeWidget: jest.fn() });
});

describe('Dashboard — the calm default + the long-press menu (AOD-195)', () => {
  it('calm is the default: the pager, NO dial, Add + Settings, and NO Done', () => {
    renderDashboard();
    expect(screen.getByTestId('sky-pager')).toBeTruthy();
    expect(screen.queryByTestId('layout-canvas')).toBeNull();
    // The dial is gone; the surface is wordless.
    expect(screen.queryByTestId('mode-dial')).toBeNull();
    expect(screen.queryByTestId('dashboard-done')).toBeNull();
    expect(screen.queryByTestId('dashboard-preview')).toBeNull();
    // The calm cluster is Add + Settings; no dashboards-switcher chevron (AOD-145).
    expect(screen.getByTestId('dashboard-add-widget')).toBeTruthy();
    expect(screen.getByTestId('dashboard-settings')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-switcher')).toBeNull();
    // No menu until a long-press.
    expect(screen.queryByTestId('card-quick-actions')).toBeNull();
  });

  it('passes the ordered skies + the active id + the active-sky instances (AOD-194) into the pager', () => {
    renderDashboard();
    expect(screen.getByTestId('pager-count').props.children).toBe('2');
    expect(screen.getByTestId('pager-active').props.children).toBe('d1');
    expect(screen.getByTestId('pager-active-instances').props.children).toBe('i1');
  });

  it('a long-press on a card opens the quick-actions menu (still calm — no Arrange yet)', () => {
    renderDashboard();
    fireEvent.press(screen.getByTestId('pager-longpress-d1'));
    expect(screen.getByTestId('card-quick-actions')).toBeTruthy();
    expect(screen.getByTestId('menu-instance').props.children).toBe('i1');
    // The menu is an overlay over the calm surface — the pager stays, no arrange canvas.
    expect(screen.getByTestId('sky-pager')).toBeTruthy();
    expect(screen.queryByTestId('layout-canvas')).toBeNull();
  });

  it('a dismiss closes the menu', () => {
    renderDashboard();
    fireEvent.press(screen.getByTestId('pager-longpress-d1'));
    fireEvent.press(screen.getByTestId('menu-dismiss'));
    expect(screen.queryByTestId('card-quick-actions')).toBeNull();
  });

  it('long-pressing a card on a NON-active sky makes it active on open (so the menu targets it)', () => {
    const setActive = jest.fn();
    mockUseDashboards.mockReturnValue(loaded({ setActive }));
    renderDashboard();
    fireEvent.press(screen.getByTestId('pager-longpress-d2')); // d2 != active d1
    // Seed-before-setActive, mirroring enterArrange, so the menu's Size/Delete/Edit Screen operate on d2.
    expect(mockSeedActiveFromSky).toHaveBeenCalledWith(expect.anything(), 'u1', 'd2', 'landscape');
    expect(setActive).toHaveBeenCalledWith('d2');
    expect(screen.getByTestId('card-quick-actions')).toBeTruthy();
  });

  it('long-pressing a card on the ACTIVE sky does NOT re-activate it (no reload), still opens the menu', () => {
    const setActive = jest.fn();
    mockUseDashboards.mockReturnValue(loaded({ setActive }));
    renderDashboard();
    fireEvent.press(screen.getByTestId('pager-longpress-d1')); // d1 IS active
    expect(setActive).not.toHaveBeenCalled();
    expect(mockSeedActiveFromSky).not.toHaveBeenCalled();
    expect(screen.getByTestId('card-quick-actions')).toBeTruthy();
  });
});

describe('Dashboard — the menu items route to the existing actions (AOD-195)', () => {
  it('Edit Screen enters Arrange (canvas + Done + Preview); the menu closes and the pager yields', () => {
    renderDashboard();
    enterArrangeViaMenu();
    expect(screen.getByTestId('layout-canvas')).toBeTruthy();
    expect(canvasMode()).toBe('arrange');
    expect(screen.getByTestId('dashboard-done')).toBeTruthy();
    expect(screen.getByTestId('dashboard-preview')).toBeTruthy();
    expect(screen.queryByTestId('card-quick-actions')).toBeNull(); // menu closed
    expect(screen.queryByTestId('sky-pager')).toBeNull(); // the pager yields to the arrange surface
    expect(screen.queryByTestId('dashboard-add-widget')).toBeNull(); // calm cluster yields to Done/Preview
  });

  it('Done exits Arrange (back to the pager) and hands the layout back (seedSkyFromActive)', () => {
    renderDashboard();
    enterArrangeViaMenu();
    expect(canvasMode()).toBe('arrange');

    fireEvent.press(screen.getByTestId('dashboard-done'));
    expect(screen.getByTestId('sky-pager')).toBeTruthy();
    expect(screen.queryByTestId('layout-canvas')).toBeNull();
    expect(screen.queryByTestId('dashboard-done')).toBeNull();
    expect(screen.getByTestId('dashboard-add-widget')).toBeTruthy();
    // The just-edited layout is handed back to the pager's per-sky cache (the old dial-to-Glance behavior).
    expect(mockSeedSkyFromActive).toHaveBeenCalledWith(expect.anything(), 'u1', 'd1', 'landscape');
  });

  it('Edit Widget opens OUR ConfigureInstanceModal (a separate sheet, NOT an inline card-flip)', () => {
    renderDashboard();
    fireEvent.press(screen.getByTestId('pager-longpress-d1'));
    fireEvent.press(screen.getByTestId('menu-edit-widget'));
    expect(screen.getByTestId('config-modal').props.children).toBe('i1');
    expect(screen.queryByTestId('card-quick-actions')).toBeNull(); // menu closed
    // We did NOT enter Arrange — Edit Widget is a config entry, not a mode change.
    expect(screen.queryByTestId('layout-canvas')).toBeNull();
  });

  it('Delete arms the calm tile-face confirm (confirmingRemoveId threaded to the pager), no Arrange', () => {
    renderDashboard();
    fireEvent.press(screen.getByTestId('pager-longpress-d1'));
    fireEvent.press(screen.getByTestId('menu-delete'));
    expect(screen.queryByTestId('card-quick-actions')).toBeNull(); // menu closed
    expect(screen.getByTestId('pager-confirming').props.children).toBe('i1'); // threaded to the calm card
    expect(screen.queryByTestId('layout-canvas')).toBeNull(); // never entered Arrange (sub-decision 6b)
  });

  it('the size row re-snaps via commit at the NEAREST-FREE footprint (a grow that would overlap nudges)', () => {
    const commit = jest.fn();
    // i1 at (0,0) 1x1 and a neighbour i2 at (1,0): growing i1 to L (2x2) at its origin would overlap i2, so
    // nearest-free places it one row down (0,1) — the AOD-197 re-validation the Arrange corner-drag also uses.
    mockUseDashboards.mockReturnValue(
      loaded({
        commit,
        instances: [card('i1', { x: 0, y: 0, w: 1, h: 1, z: 0 }), card('i2', { x: 1, y: 0, w: 1, h: 1, z: 1 })],
      }),
    );
    renderDashboard();
    fireEvent.press(screen.getByTestId('pager-longpress-d1'));
    fireEvent.press(screen.getByTestId('menu-size-L'));
    expect(commit).toHaveBeenCalledWith('i1', { rect: { x: 0, y: 1, w: 2, h: 2, z: 0 }, size: 'L' });
  });

  it('the size row keeps the menu open (so the segmented can re-mark the applied size)', () => {
    renderDashboard();
    fireEvent.press(screen.getByTestId('pager-longpress-d1'));
    fireEvent.press(screen.getByTestId('menu-size-L'));
    expect(screen.getByTestId('card-quick-actions')).toBeTruthy(); // stays open, unlike the other items
  });
});

describe('Dashboard — the empty-canvas long-press + chrome (AOD-195)', () => {
  it('a long-press on an EMPTY sky enters Edit Screen directly (no card to hold)', () => {
    const setActive = jest.fn();
    mockUseDashboards.mockReturnValue(loaded({ setActive }));
    renderDashboard();
    fireEvent.press(screen.getByTestId('pager-empty-longpress-d2')); // -> onEnterArrange('d2')
    expect(canvasMode()).toBe('arrange');
    expect(setActive).toHaveBeenCalledWith('d2'); // d2 != active d1 -> made active
  });

  it('sinks the chrome after the idle window and wakes it on a surface touch (drives the dots/capsule)', () => {
    jest.useFakeTimers();
    try {
      renderDashboard();
      expect(screen.getByTestId('pager-awake').props.children).toBe('awake');
      act(() => {
        jest.advanceTimersByTime(CHROME_IDLE_MS);
      });
      expect(screen.getByTestId('pager-awake').props.children).toBe('sunk');
      fireEvent(screen.getByTestId('dashboard-surface'), 'touchStart', { nativeEvent: {} });
      expect(screen.getByTestId('pager-awake').props.children).toBe('awake');
    } finally {
      jest.useRealTimers();
    }
  });

  it('hides Add while the board loads — nothing to arrange yet; Settings stays, no dial', () => {
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

// AOD-195 hardening (F1): a pending CALM "Remove?" confirm (confirmingRemoveId) must not survive an Edit
// Screen transition — entering AND leaving Arrange clear it, so a confirm armed on one sky can't re-appear on
// returning to it after an arrange round-trip. An ordinary swipe (not an edit transition) is left untouched.
describe('Dashboard — a pending calm menu-confirm is dropped on Edit Screen transitions (AOD-195)', () => {
  const armCalmConfirm = () => {
    fireEvent.press(screen.getByTestId('pager-longpress-d1'));
    fireEvent.press(screen.getByTestId('menu-delete'));
    expect(screen.getByTestId('pager-confirming').props.children).toBe('i1');
  };

  it('survives an ordinary swipe (only a new menu open or an arrange transition clears it)', () => {
    renderDashboard();
    armCalmConfirm();
    fireEvent.press(screen.getByTestId('pager-swipe-to-1')); // a page turn is not an edit transition
    expect(screen.getByTestId('pager-confirming').props.children).toBe('i1'); // still armed
  });

  it('is cleared across an Edit Screen round-trip (enter via empty-canvas long-press, exit via Done)', () => {
    renderDashboard();
    armCalmConfirm();
    // Enter Edit Screen WITHOUT re-opening the menu — the empty-canvas long-press routes through enterArrange,
    // so this exercises the enter-side clear (openCardMenu is not involved on this path).
    fireEvent.press(screen.getByTestId('pager-empty-longpress-d2'));
    expect(canvasMode()).toBe('arrange');
    // Leave via Done, and the stale confirm is gone (it would otherwise re-appear on returning to its sky).
    fireEvent.press(screen.getByTestId('dashboard-done'));
    expect(screen.getByTestId('pager-confirming').props.children).toBe('none');
  });
});

describe('Dashboard — the two Arrange altitudes §1b (AOD-145), entered via the menu', () => {
  // Enter Arrange (card altitude) through the menu, then press the grown page-dots capsule to rise.
  const rise = () => {
    enterArrangeViaMenu();
    fireEvent.press(screen.getByTestId('page-capsule-press'));
  };

  it('card altitude carries the page-dots capsule (the door up); calm does not', () => {
    renderDashboard();
    expect(screen.queryByTestId('page-capsule')).toBeNull(); // calm: no capsule

    enterArrangeViaMenu();
    expect(canvasMode()).toBe('arrange');
    expect(screen.getByTestId('page-capsule')).toBeTruthy(); // card altitude: the capsule appears
    expect(screen.getByTestId('page-capsule-press')).toBeTruthy();
  });

  it('pressing the capsule RISES to page altitude (thumbnails), swapping out the card canvas; Done stays', () => {
    renderDashboard();
    rise();

    expect(screen.getByTestId('page-altitude')).toBeTruthy();
    expect(screen.queryByTestId('layout-canvas')).toBeNull(); // the card surface yields to page altitude
    expect(screen.getByTestId('pa-count').props.children).toBe('2'); // the ordered skies are passed down
    // Preview is hidden at page altitude (it previews one sky's wall), but Done still exits from here.
    expect(screen.queryByTestId('dashboard-preview')).toBeNull();
    expect(screen.getByTestId('dashboard-done')).toBeTruthy();
  });

  it('Done EXITS to Glance from page altitude (either altitude leaves Arrange)', () => {
    renderDashboard();
    rise();
    expect(screen.getByTestId('page-altitude')).toBeTruthy();

    fireEvent.press(screen.getByTestId('dashboard-done'));
    expect(screen.getByTestId('sky-pager')).toBeTruthy();
    expect(screen.queryByTestId('page-altitude')).toBeNull();
    expect(screen.queryByTestId('layout-canvas')).toBeNull();
  });

  it('tapping a sky at page altitude DESCENDS: sets it active and lands at card altitude', () => {
    const setActive = jest.fn();
    mockUseDashboards.mockReturnValue(loaded({ setActive }));
    renderDashboard();
    rise();

    fireEvent.press(screen.getByTestId('pa-tap-d2')); // descend into d2 (not the active d1)
    expect(setActive).toHaveBeenCalledWith('d2');
    expect(mockSeedActiveFromSky).toHaveBeenCalledWith(expect.anything(), 'u1', 'd2', 'landscape'); // paints d2 at once
    expect(canvasMode()).toBe('arrange'); // back at card altitude
    expect(screen.queryByTestId('page-altitude')).toBeNull();
  });
});
