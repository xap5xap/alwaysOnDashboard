// Component band: the Glance sky pager (AOD-144; Many Skies §1a "the paged canvas" + §1f "the second sky").
// The BILLING GATE lives here, so the Pro-gate assertions are the load-bearing ones: on Free the + opens the
// in-place "second sky is Pro" invite and reaches the paywall ONLY through its See Pro; on Pro the + creates
// a real sky and never touches the paywall. It also proves the read-only pager shape (one page per sky), the
// dots (count + current page from the pager's own scroll state, riding the chrome-awake state), the swipe
// wakes the chrome, and a long-press / empty "Add a card" route up per sky. useSkyInstances + LayoutCanvas
// are stubbed (their own suites cover them); entitlements run real through CustomerInfoProvider, exactly as
// the DashboardsSwitcher billing test does.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PRO_ENTITLEMENT_ID } from '@vela/shared';
import { CustomerInfoProvider } from '../../entitlements/CustomerInfoContext';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../layout/useSkyInstances', () => ({ useSkyInstances: jest.fn() }));
// The read-only page body is stubbed to a marker + a long-press trigger (its real render is LayoutCanvas's
// concern). Each page's canvas carries the sky id it was mounted for so the per-sky long-press is assertable.
jest.mock('../../layout/LayoutCanvas', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    LayoutCanvas: ({ instances, onEnterArrange }: { instances: { instanceId: string }[]; onEnterArrange: () => void }) =>
      React.createElement(
        View,
        { testID: 'layout-canvas' },
        React.createElement(Text, { testID: 'canvas-count' }, String(instances.length)),
        React.createElement(Pressable, { testID: 'canvas-longpress', onPress: onEnterArrange }, React.createElement(Text, null, 'lp')),
      ),
  };
});

import { router } from 'expo-router';
import { useSkyInstances } from '../../layout/useSkyInstances';
import { SkyPager } from '../SkyPager';

const mockUseSkyInstances = useSkyInstances as jest.Mock;

const TWO_SKIES = [
  { id: 'd1', name: 'Wall', position: 0 },
  { id: 'd2', name: 'Travel', position: 1 },
];

const nonEmptySky = { instances: [{ instanceId: 'i1' }], isLoading: false, isError: false, refetch: jest.fn() };

function renderPager(
  activeEntitlementIds: string[],
  props: Partial<React.ComponentProps<typeof SkyPager>> = {},
) {
  const all: React.ComponentProps<typeof SkyPager> = {
    dashboards: TWO_SKIES,
    activeId: 'd1',
    onEnterArrange: jest.fn(),
    onAddCard: jest.fn(),
    createDashboard: jest.fn().mockResolvedValue('d3'),
    awake: true,
    wake: jest.fn(),
    onPageChange: jest.fn(),
    ...props,
  };
  const utils = render(
    <CustomerInfoProvider value={{ activeEntitlementIds }}>
      <SkyPager {...all} />
    </CustomerInfoProvider>,
  );
  return { ...utils, props: all };
}

// Fire the pager's settle handler with a controlled page width so the index math is deterministic.
function swipeTo(index: number, width = 300) {
  fireEvent(screen.getByTestId('sky-pager-list'), 'momentumScrollEnd', {
    nativeEvent: { contentOffset: { x: width * index, y: 0 }, layoutMeasurement: { width, height: 600 } },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSkyInstances.mockReturnValue(nonEmptySky);
});

describe('SkyPager — the paged canvas §1a', () => {
  it('renders one read-only page per sky', () => {
    renderPager([]);
    expect(screen.getByTestId('sky-page-d1')).toBeTruthy();
    expect(screen.getByTestId('sky-page-d2')).toBeTruthy();
    // Both pages render their read-only canvas (arranging is never true in the pager).
    expect(screen.getAllByTestId('layout-canvas').length).toBe(2);
  });

  it('reports the mount landing page (the active sky index) up once', () => {
    const onPageChange = jest.fn();
    renderPager([], { activeId: 'd2', onPageChange });
    expect(onPageChange).toHaveBeenCalledWith(1); // d2 is index 1
  });

  it('shows a dot per sky with the current one selected, and updates on swipe', () => {
    renderPager([]);
    expect(screen.getByTestId('page-dots-dot-0').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('page-dots-dot-1').props.accessibilityState).toMatchObject({ selected: false });

    swipeTo(1);
    expect(screen.getByTestId('page-dots-dot-1').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('page-dots-dot-0').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('reports each settled page up (the dial reads it to arrange the on-screen sky)', () => {
    const onPageChange = jest.fn();
    renderPager([], { onPageChange });
    onPageChange.mockClear(); // drop the mount report
    swipeTo(1);
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('a single sky shows the + but no dots (position is only meaningful with >1 sky)', () => {
    renderPager([], { dashboards: [{ id: 'd1', name: 'Wall', position: 0 }], activeId: 'd1' });
    expect(screen.queryByTestId('page-dots-dots')).toBeNull(); // no dot strip
    expect(screen.getByTestId('page-dots-add')).toBeTruthy(); // the + is still reachable
  });

  it('a swipe wakes the chrome (onScrollBeginDrag -> wake)', () => {
    const wake = jest.fn();
    renderPager([], { wake });
    fireEvent(screen.getByTestId('sky-pager-list'), 'scrollBeginDrag', { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(wake).toHaveBeenCalled();
  });

  it('the dots ride the chrome-awake state: interactive awake, sunk + non-interactive idle', () => {
    const { rerender, props } = renderPager([], { awake: true });
    expect(screen.getByTestId('page-dots').props.pointerEvents).toBe('box-none');

    rerender(
      <CustomerInfoProvider value={{ activeEntitlementIds: [] }}>
        <SkyPager {...props} awake={false} />
      </CustomerInfoProvider>,
    );
    expect(screen.getByTestId('page-dots', { includeHiddenElements: true }).props.pointerEvents).toBe('none');
  });
});

describe('SkyPager — the second sky Pro gate §1f (the billing gate)', () => {
  it('FREE: the + opens the in-place invite and does NOT navigate to the paywall', () => {
    const createDashboard = jest.fn();
    renderPager([], { createDashboard });

    expect(screen.queryByTestId('pro-invite')).toBeNull();
    fireEvent.press(screen.getByTestId('page-dots-add'));

    // The invitation appears IN PLACE — not the paywall route, not a create.
    expect(screen.getByTestId('pro-invite')).toBeTruthy();
    expect(screen.getByText('A second dashboard is part of Pro.')).toBeTruthy();
    expect(screen.getByTestId('pro-invite-badge')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(createDashboard).not.toHaveBeenCalled();
  });

  it('FREE: the invite reaches the paywall ONLY through See Pro (trigger=dashboards)', () => {
    renderPager([]);
    fireEvent.press(screen.getByTestId('page-dots-add'));
    fireEvent.press(screen.getByTestId('pro-invite-see-pro'));

    expect(router.push).toHaveBeenCalledWith('/paywall?trigger=dashboards');
    // Tapping through dismisses the in-place invite.
    expect(screen.queryByTestId('pro-invite')).toBeNull();
  });

  it('FREE: tapping off the card dismisses the invite without navigating', () => {
    renderPager([]);
    fireEvent.press(screen.getByTestId('page-dots-add'));
    expect(screen.getByTestId('pro-invite')).toBeTruthy();

    fireEvent.press(screen.getByTestId('pro-invite-dismiss'));
    expect(screen.queryByTestId('pro-invite')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('PRO: the + creates a real sky and never opens the invite or the paywall', async () => {
    const createDashboard = jest.fn().mockResolvedValue('d3');
    renderPager([PRO_ENTITLEMENT_ID], { createDashboard });

    fireEvent.press(screen.getByTestId('page-dots-add'));

    await waitFor(() => expect(createDashboard).toHaveBeenCalled());
    expect(screen.queryByTestId('pro-invite')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('FREE with an empty/incoherent list: the + shows the invite and NEVER creates (defense in depth)', () => {
    // The new-user list race can transiently resolve []; the gate must refuse to read 0 < 1 as "create is
    // free" (a billing bypass). useDashboards heals the list; this guard closes the window before it lands.
    const createDashboard = jest.fn();
    renderPager([], { dashboards: [], activeId: null, createDashboard });

    fireEvent.press(screen.getByTestId('page-dots-add'));
    expect(screen.getByTestId('pro-invite')).toBeTruthy();
    expect(createDashboard).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('SkyPager — per-page states', () => {
  it('an empty sky page offers "Add a card" that routes up with the sky id', () => {
    mockUseSkyInstances.mockReturnValue({ instances: [], isLoading: false, isError: false, refetch: jest.fn() });
    const onAddCard = jest.fn();
    renderPager([], { dashboards: [{ id: 'd1', name: 'Wall', position: 0 }], activeId: 'd1', onAddCard });

    expect(screen.getByTestId('sky-page-d1-empty')).toBeTruthy();
    fireEvent.press(screen.getByTestId('screen-empty-action'));
    expect(onAddCard).toHaveBeenCalledWith('d1');
  });

  it('a long-press on a page card drops into Arrange for THAT sky', () => {
    const onEnterArrange = jest.fn();
    renderPager([], { onEnterArrange });
    // The second page's canvas -> sky d2.
    fireEvent.press(screen.getAllByTestId('canvas-longpress')[1]);
    expect(onEnterArrange).toHaveBeenCalledWith('d2');
  });

  it("a page still loading shows that page's loading state", () => {
    mockUseSkyInstances.mockReturnValue({ instances: [], isLoading: true, isError: false, refetch: jest.fn() });
    renderPager([], { dashboards: [{ id: 'd1', name: 'Wall', position: 0 }], activeId: 'd1' });
    expect(screen.getByTestId('sky-page-d1-loading')).toBeTruthy();
  });
});
