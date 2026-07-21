// Component band: the dashboard hub as the AOD-142 EDIT-GUARD shell (design "The sky fills in" §1e). It
// proves what the screen OWNS: the Glance | Arrange dial drives the `arranging` flag (so affordances gate
// on it), the Done pill is gone while the wall Preview stays (AOD-81), a long-press on a card still
// shortcuts into Arrange, and the hub chrome sinks on the idle timer / wakes on a surface touch. LayoutCanvas
// is stubbed (its affordance gating + the registry are tested elsewhere, WallPreview.test's philosophy) so
// these assertions stay about the mode shell, not the placed cards.
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { CHROME_IDLE_MS } from '../useChromeAwake';

jest.mock('../../layout/useDashboard', () => ({ useDashboard: jest.fn() }));
jest.mock('../../layout/useRemoveWidget', () => ({ useRemoveWidget: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

// The layout engine is stubbed to expose the `arranging` prop it receives + an onEnterArrange trigger (the
// long-press shortcut). Its real affordance gating on `arranging` is PlacedInstance's concern, not the hub's.
jest.mock('../../layout/LayoutCanvas', () => {
  const React = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    LayoutCanvas: ({ arranging, onEnterArrange }: { arranging: boolean; onEnterArrange: () => void }) =>
      React.createElement(
        View,
        { testID: 'layout-canvas' },
        React.createElement(Text, { testID: 'canvas-mode' }, arranging ? 'arrange' : 'glance'),
        // onPress stands in for the long-press-a-card gesture that fires onEnterArrange.
        React.createElement(Pressable, { testID: 'fake-card', onPress: onEnterArrange }, React.createElement(Text, null, 'card')),
      ),
  };
});
// Overlays that only mount from state we never set here — stub them so the hub renders in isolation.
jest.mock('../../layout/WidgetPicker', () => ({ WidgetPicker: () => null }));
jest.mock('../../layout/ConfigureInstanceModal', () => ({ ConfigureInstanceModal: () => null }));
jest.mock('../../kiosk/WallPreview', () => ({ WallPreview: () => null }));

import { useDashboard } from '../../layout/useDashboard';
import { useRemoveWidget } from '../../layout/useRemoveWidget';
import { Dashboard } from '../Dashboard';

const mockUseDashboard = useDashboard as jest.Mock;
const mockUseRemoveWidget = useRemoveWidget as jest.Mock;

const loaded = (overrides: Record<string, unknown> = {}) => ({
  instances: [{ instanceId: 'i1' }],
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  commit: jest.fn(),
  ...overrides,
});

const mode = () => screen.getByTestId('canvas-mode').props.children;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDashboard.mockReturnValue(loaded());
  mockUseRemoveWidget.mockReturnValue({ removeWidget: jest.fn() });
});

describe('Dashboard — the Glance / Arrange mode shell §1e', () => {
  it('renders the dial; Glance is default, with the hub actions and NO Done pill', () => {
    render(<Dashboard />);
    expect(screen.getByTestId('segmented-glance').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('segmented-arrange')).toBeTruthy();
    expect(mode()).toBe('glance');
    // The dial replaced the Done pill; Preview is arrange-only.
    expect(screen.queryByTestId('dashboard-done')).toBeNull();
    expect(screen.queryByTestId('dashboard-preview')).toBeNull();
    // The Glance hub cluster is intact.
    expect(screen.getByTestId('dashboard-add-widget')).toBeTruthy();
    expect(screen.getByTestId('dashboard-settings')).toBeTruthy();
    expect(screen.getByTestId('dashboard-switcher')).toBeTruthy();
  });

  it('flipping the dial to Arrange enters arrange mode and swaps the header to Preview (never a Done)', () => {
    render(<Dashboard />);
    fireEvent.press(screen.getByTestId('segmented-arrange'));

    expect(mode()).toBe('arrange');
    expect(screen.getByTestId('segmented-arrange').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('dashboard-preview')).toBeTruthy(); // AOD-81 pill kept
    expect(screen.queryByTestId('dashboard-done')).toBeNull(); // never a Done pill
    // The hub actions yield to Preview while arranging.
    expect(screen.queryByTestId('dashboard-add-widget')).toBeNull();
  });

  it('flipping the dial back to Glance leaves arrange mode', () => {
    render(<Dashboard />);
    fireEvent.press(screen.getByTestId('segmented-arrange'));
    expect(mode()).toBe('arrange');

    fireEvent.press(screen.getByTestId('segmented-glance'));
    expect(mode()).toBe('glance');
    expect(screen.queryByTestId('dashboard-preview')).toBeNull();
    expect(screen.getByTestId('dashboard-add-widget')).toBeTruthy();
  });

  it('holding a card in Glance jumps into Arrange (the long-press shortcut is kept)', () => {
    render(<Dashboard />);
    expect(mode()).toBe('glance');

    fireEvent.press(screen.getByTestId('fake-card')); // the stubbed long-press -> onEnterArrange
    expect(mode()).toBe('arrange');
    expect(screen.getByTestId('segmented-arrange').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('sinks the dial after the idle window and wakes it on a surface touch', () => {
    jest.useFakeTimers();
    try {
      render(<Dashboard />);
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
    mockUseDashboard.mockReturnValue(loaded({ isLoading: true, instances: [] }));
    render(<Dashboard />);
    expect(screen.queryByTestId('mode-dial')).toBeNull();
    expect(screen.queryByTestId('dashboard-add-widget')).toBeNull();
    expect(screen.getByTestId('dashboard-settings')).toBeTruthy();
    expect(screen.getByTestId('screen-loading')).toBeTruthy();
  });
});
