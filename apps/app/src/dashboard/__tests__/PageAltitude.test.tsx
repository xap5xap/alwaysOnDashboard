// Component band: page altitude (AOD-145; Many Skies §1b/§1e/§1g). This is the RETIREMENT home of the
// DashboardsSwitcher — its ~9 assertions are migrated here honestly: the list marks the current sky (now the
// RINGED tile), tapping a sky selects/descends into it (now onTapSky, not a modal dismiss), and the create
// gate (Free vs Pro) still governs the + (now the in-place §1f ProInviteSliver on Free, a real create on Pro,
// per the design's evolution away from the LockRow). The switcher's back / loading / error assertions moved to
// Dashboard's own suite, where the combined useDashboards states now live (page altitude only mounts once
// loaded). New coverage: thumbnails per sky, the ringed mark, reorder -> reorderDashboards, the label field ->
// renameDashboard, the delete tile-face -> deleteDashboard + the last-sky rule, and the + Pro fork.
//
// useSkyInstances (each thumbnail's silhouette read) is mocked; entitlements run real through
// CustomerInfoProvider exactly as the SkyPager billing test does. gesture-handler is mocked to a fireable
// stub: the reorder feel is device-only (AOD-190), but the DROP wiring (which order it commits) is asserted by
// firing the captured Pan.onEnd — the same "test the result, not the gesture" split as PlacedInstance.
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { PRO_ENTITLEMENT_ID } from '@vela/shared';
import { CustomerInfoProvider } from '../../entitlements/CustomerInfoContext';

// The reorder Pan handlers, captured in render order so a test can fire one thumbnail's drop. Cleared each
// test; a component re-render re-pushes, so tests read the LAST `count` entries (the current render's tiles).
const mockPanHandlers: Array<Record<string, (...args: unknown[]) => unknown>> = [];

jest.mock('react-native-gesture-handler', () => {
  const makePan = () => {
    const h: Record<string, (...args: unknown[]) => unknown> = {};
    const g: Record<string, (fn?: unknown) => unknown> = {};
    ['enabled', 'activateAfterLongPress', 'minDuration', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'onBegin', 'onChange'].forEach((m) => {
      g[m] = (fn?: unknown) => {
        if (typeof fn === 'function') h[m] = fn as (...args: unknown[]) => unknown;
        return g;
      };
    });
    mockPanHandlers.push(h);
    return g;
  };
  const makeSimple = () => {
    const g: Record<string, () => unknown> = {};
    ['enabled', 'onStart', 'onEnd', 'onFinalize', 'scaleTo'].forEach((m) => {
      g[m] = () => g;
    });
    return g;
  };
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pan: makePan, Pinch: makeSimple, LongPress: makeSimple },
  };
});

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../layout/useSkyInstances', () => ({ useSkyInstances: jest.fn() }));

import { router } from 'expo-router';
import { useSkyInstances } from '../../layout/useSkyInstances';
import { PageAltitude, reorderIds } from '../PageAltitude';
import { REORDER_STRIDE } from '../SkyThumbnail';

const mockUseSkyInstances = useSkyInstances as jest.Mock;

const ONE = { id: 'd1', name: 'Wall', position: 0 };
const TWO = [ONE, { id: 'd2', name: 'Travel', position: 1 }];
const THREE = [ONE, { id: 'd2', name: 'Travel', position: 1 }, { id: 'd3', name: 'Trips', position: 2 }];

// Two cards per sky, so the delete tile-face reads "Its 2 cards go with it." and the silhouette has blocks.
const inst = (id: string) => ({ instanceId: id, serviceId: 'stub', widgetType: 'w', config: {}, size: 'S', rect: { x: 0, y: 0, w: 1, h: 1, z: 0 } });
const twoCards = { instances: [inst('a'), inst('b')], isLoading: false, isError: false, refetch: jest.fn() };

function renderPageAltitude(
  activeEntitlementIds: string[],
  props: Partial<React.ComponentProps<typeof PageAltitude>> = {},
) {
  const all: React.ComponentProps<typeof PageAltitude> = {
    dashboards: TWO,
    activeId: 'd1',
    onTapSky: jest.fn(),
    createDashboard: jest.fn().mockResolvedValue('d3'),
    onCreated: jest.fn(),
    renameDashboard: jest.fn(),
    reorderDashboards: jest.fn(),
    deleteDashboard: jest.fn(),
    ...props,
  };
  const utils = render(
    <CustomerInfoProvider value={{ activeEntitlementIds }}>
      <PageAltitude {...all} />
    </CustomerInfoProvider>,
  );
  return { ...utils, props: all };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPanHandlers.length = 0;
  mockUseSkyInstances.mockReturnValue(twoCards);
});

describe('reorderIds (the pure reorder-order contract)', () => {
  it('moves an item forward, back, and no-ops a same-slot move', () => {
    expect(reorderIds(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(reorderIds(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(reorderIds(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('clamps an out-of-range target and returns a copy for an out-of-range source', () => {
    expect(reorderIds(['a', 'b', 'c'], 0, 9)).toEqual(['b', 'c', 'a']); // to clamped to the last slot
    const ids = ['a', 'b'];
    const out = reorderIds(ids, 5, 0);
    expect(out).toEqual(['a', 'b']);
    expect(out).not.toBe(ids); // a fresh copy, never the same reference
  });
});

describe('PageAltitude — thumbnails + the ringed sky §1b', () => {
  it('renders one thumbnail per sky and rings the current (active) one', () => {
    renderPageAltitude([PRO_ENTITLEMENT_ID], { dashboards: TWO, activeId: 'd2' });
    expect(screen.getByTestId('sky-thumb-d1')).toBeTruthy();
    expect(screen.getByTestId('sky-thumb-d2')).toBeTruthy();
    // The ring is the AOD-140 selection language, surfaced as accessibilityState.selected on the tile.
    expect(screen.getByTestId('sky-thumb-d1-tile').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('sky-thumb-d2-tile').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('tapping a thumbnail descends into that sky (onTapSky)', () => {
    const onTapSky = jest.fn();
    renderPageAltitude([PRO_ENTITLEMENT_ID], { dashboards: TWO, activeId: 'd1', onTapSky });
    fireEvent.press(screen.getByTestId('sky-thumb-d2-tile'));
    expect(onTapSky).toHaveBeenCalledWith('d2');
  });

  it('the label field shows ONLY on the ringed sky; a nameless sky shows the empty "Add label" field', () => {
    // d2 is active AND nameless; d1 is named but not ringed.
    renderPageAltitude([PRO_ENTITLEMENT_ID], {
      dashboards: [ONE, { id: 'd2', name: '', position: 1 }],
      activeId: 'd2',
    });
    expect(screen.getByTestId('sky-thumb-d2-label').props.value).toBe(''); // nameless -> empty
    expect(screen.getByPlaceholderText('Add label')).toBeTruthy();
    expect(screen.queryByTestId('sky-thumb-d1-label')).toBeNull(); // non-ringed -> no label (dots, not names)
  });

  it('editing the ringed label calls renameDashboard; clearing returns the sky to nameless', () => {
    const renameDashboard = jest.fn();
    renderPageAltitude([PRO_ENTITLEMENT_ID], { dashboards: TWO, activeId: 'd1', renameDashboard });
    const input = screen.getByTestId('sky-thumb-d1-label');
    // Rename commits on blur/submit (onEndEditing), not per keystroke, so it does not fire a refetch per key.
    fireEvent.changeText(input, 'Home');
    fireEvent(input, 'endEditing', { nativeEvent: { text: 'Home' } });
    expect(renameDashboard).toHaveBeenCalledWith('d1', 'Home');
    fireEvent.changeText(input, '');
    fireEvent(input, 'endEditing', { nativeEvent: { text: '' } });
    expect(renameDashboard).toHaveBeenLastCalledWith('d1', ''); // '' == nameless (§1e)
  });
});

describe('PageAltitude — delete-in-place §1e (the AOD-141 tile-face)', () => {
  it('the Delete pill flips the tile face to the question (no immediate delete); Keep reverts', () => {
    const deleteDashboard = jest.fn();
    renderPageAltitude([PRO_ENTITLEMENT_ID], { dashboards: TWO, activeId: 'd1', deleteDashboard });

    fireEvent.press(screen.getByTestId('sky-thumb-d1-delete'));
    expect(screen.getByTestId('sky-thumb-d1-delete-confirm')).toBeTruthy();
    expect(screen.getByText('Its 2 cards go with it.')).toBeTruthy(); // N cards from useSkyInstances
    expect(deleteDashboard).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('sky-thumb-d1-delete-keep'));
    expect(screen.queryByTestId('sky-thumb-d1-delete-confirm')).toBeNull();
    expect(deleteDashboard).not.toHaveBeenCalled();
  });

  it('confirming the tile face calls deleteDashboard (connections survive — only the arrangement dies)', () => {
    const deleteDashboard = jest.fn();
    renderPageAltitude([PRO_ENTITLEMENT_ID], { dashboards: TWO, activeId: 'd1', deleteDashboard });
    fireEvent.press(screen.getByTestId('sky-thumb-d1-delete'));
    fireEvent.press(screen.getByTestId('sky-thumb-d1-delete-confirm-yes'));
    expect(deleteDashboard).toHaveBeenCalledWith('d1');
  });

  it('the LAST sky offers NO delete (it can only be emptied — the §1e last-sky rule)', () => {
    renderPageAltitude([PRO_ENTITLEMENT_ID], { dashboards: [ONE], activeId: 'd1' });
    expect(screen.getByTestId('sky-thumb-d1')).toBeTruthy();
    expect(screen.queryByTestId('sky-thumb-d1-delete')).toBeNull();
  });
});

describe('PageAltitude — reorder §1e (drop wiring)', () => {
  it('a drop that travels one stride right commits the moved order to reorderDashboards', () => {
    const reorderDashboards = jest.fn();
    renderPageAltitude([PRO_ENTITLEMENT_ID], { dashboards: THREE, activeId: 'd1', reorderDashboards });

    // The last three captured Pans are this render's tiles, in index order. Fire tile 0's drop one stride
    // right -> target index 1 (the feel is device-only; this asserts the committed order).
    const handlers = mockPanHandlers.slice(-3);
    act(() => {
      handlers[0].onEnd({ translationX: REORDER_STRIDE }, true);
    });
    expect(reorderDashboards).toHaveBeenCalledWith(['d2', 'd1', 'd3']);
  });

  it('a drop that does not change slot commits nothing', () => {
    const reorderDashboards = jest.fn();
    renderPageAltitude([PRO_ENTITLEMENT_ID], { dashboards: THREE, activeId: 'd1', reorderDashboards });
    const handlers = mockPanHandlers.slice(-3);
    act(() => {
      handlers[1].onEnd({ translationX: 4 }, true); // < half a stride -> rounds to the same index
    });
    expect(reorderDashboards).not.toHaveBeenCalled();
  });
});

describe('PageAltitude — the + new sky Pro gate §1f (migrated from the switcher create gate)', () => {
  it('FREE at the limit: the + opens the in-place invite — no create, no paywall navigation', () => {
    const createDashboard = jest.fn();
    renderPageAltitude([], { dashboards: [ONE], activeId: 'd1', createDashboard }); // Free maxDashboards=1, at limit

    expect(screen.queryByTestId('pro-invite')).toBeNull();
    fireEvent.press(screen.getByTestId('page-altitude-add'));

    expect(screen.getByTestId('pro-invite')).toBeTruthy();
    expect(screen.getByText('A second dashboard is part of Pro.')).toBeTruthy();
    expect(createDashboard).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('FREE: the invite reaches the paywall ONLY through See Pro (trigger=dashboards)', () => {
    renderPageAltitude([], { dashboards: [ONE], activeId: 'd1' });
    fireEvent.press(screen.getByTestId('page-altitude-add'));
    fireEvent.press(screen.getByTestId('pro-invite-see-pro'));
    expect(router.push).toHaveBeenCalledWith('/paywall?trigger=dashboards');
    expect(screen.queryByTestId('pro-invite')).toBeNull(); // tapping through dismisses it
  });

  it('PRO: the + creates a real sky and descends into it (onCreated), never opening the invite', async () => {
    const createDashboard = jest.fn().mockResolvedValue('d3');
    const onCreated = jest.fn();
    renderPageAltitude([PRO_ENTITLEMENT_ID], { dashboards: TWO, activeId: 'd1', createDashboard, onCreated });

    fireEvent.press(screen.getByTestId('page-altitude-add'));
    await waitFor(() => expect(createDashboard).toHaveBeenCalled());
    expect(onCreated).toHaveBeenCalled();
    expect(screen.queryByTestId('pro-invite')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('FREE with an empty/incoherent list: the + shows the invite and NEVER creates (defense in depth)', () => {
    const createDashboard = jest.fn();
    renderPageAltitude([], { dashboards: [], activeId: null, createDashboard });
    fireEvent.press(screen.getByTestId('page-altitude-add'));
    expect(screen.getByTestId('pro-invite')).toBeTruthy();
    expect(createDashboard).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
