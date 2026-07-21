// Component band: the dashboards switcher interior (design-dashboard-editor §8; Many Skies §1b/§1e/§1g). It
// proves the list marks the active sky, selecting a sky flips the active pointer and dismisses, the
// maxDashboards create gate (Free -> the AOD-20 LockRow routing to the paywall; Pro -> a real create), and the
// shell loading/error states. AOD-143 rewired this to the real multi-dashboard hook: useDashboards is mocked
// (its own tests cover the backing); entitlements run real through CustomerInfoProvider.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PRO_ENTITLEMENT_ID } from '@vela/shared';
import { CustomerInfoProvider } from '../../entitlements/CustomerInfoContext';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../../layout/useDashboards', () => ({ useDashboards: jest.fn() }));

import { router } from 'expo-router';
import { useDashboards } from '../../layout/useDashboards';
import { DashboardsSwitcher } from '../DashboardsSwitcher';

const mockUseDashboards = useDashboards as jest.Mock;

const loaded = (overrides: Record<string, unknown> = {}) => ({
  instances: [],
  dashboards: [{ id: 'dash-1', name: 'Wall', position: 0 }],
  activeId: 'dash-1',
  dashboardId: 'dash-1',
  dashboardName: 'Wall',
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  commit: jest.fn(),
  setActive: jest.fn(),
  createDashboard: jest.fn().mockResolvedValue('dash-new'),
  renameDashboard: jest.fn(),
  reorderDashboards: jest.fn(),
  deleteDashboard: jest.fn(),
  ...overrides,
});

function renderSwitcher(activeEntitlementIds: string[]) {
  return render(
    <CustomerInfoProvider value={{ activeEntitlementIds }}>
      <DashboardsSwitcher />
    </CustomerInfoProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDashboards.mockReturnValue(loaded());
});

describe('Dashboards switcher §8', () => {
  it('lists the active dashboard by name and marks it active', () => {
    renderSwitcher([]);
    expect(screen.getByText('Wall')).toBeTruthy();
    expect(screen.getByTestId('dashboard-row-dash-1').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('lists multiple skies, marks the active one, and labels a nameless sky', () => {
    mockUseDashboards.mockReturnValue(
      loaded({
        dashboards: [
          { id: 'dash-1', name: 'Wall', position: 0 },
          { id: 'dash-2', name: '', position: 1 },
        ],
        activeId: 'dash-2',
      }),
    );
    renderSwitcher([PRO_ENTITLEMENT_ID]);

    // A nameless sky (§1e) still renders a legible, tappable label.
    expect(screen.getByText('Wall')).toBeTruthy();
    expect(screen.getByText('Untitled sky')).toBeTruthy();
    expect(screen.getByTestId('dashboard-row-dash-2').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('dashboard-row-dash-1').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('selecting a sky flips the active pointer and dismisses', () => {
    const setActive = jest.fn();
    mockUseDashboards.mockReturnValue(
      loaded({
        dashboards: [
          { id: 'dash-1', name: 'Wall', position: 0 },
          { id: 'dash-2', name: 'Travel', position: 1 },
        ],
        activeId: 'dash-1',
        setActive,
      }),
    );
    renderSwitcher([PRO_ENTITLEMENT_ID]);

    fireEvent.press(screen.getByTestId('dashboard-row-dash-2'));
    expect(setActive).toHaveBeenCalledWith('dash-2');
    expect(router.back).toHaveBeenCalled();
  });

  it('Free: "New dashboard" is the LOCK row routing to the paywall (trigger=dashboards)', () => {
    renderSwitcher([]);
    expect(screen.getByTestId('dashboard-create-locked')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-create')).toBeNull();
    fireEvent.press(screen.getByTestId('dashboard-create-locked'));
    expect(router.push).toHaveBeenCalledWith('/paywall?trigger=dashboards');
  });

  it('Pro: "New dashboard" is an enabled create action (no lock)', () => {
    renderSwitcher([PRO_ENTITLEMENT_ID]);
    expect(screen.getByTestId('dashboard-create')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-create-locked')).toBeNull();
  });

  it('Pro: pressing "New dashboard" creates a real sky and dismisses', async () => {
    const createDashboard = jest.fn().mockResolvedValue('dash-new');
    mockUseDashboards.mockReturnValue(loaded({ createDashboard }));
    renderSwitcher([PRO_ENTITLEMENT_ID]);

    fireEvent.press(screen.getByTestId('dashboard-create'));
    expect(createDashboard).toHaveBeenCalled();
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('dismisses on back (the modal-route Close)', () => {
    renderSwitcher([]);
    fireEvent.press(screen.getByTestId('appbar-back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('shows the shell loading state while the dashboards load', () => {
    mockUseDashboards.mockReturnValue(loaded({ isLoading: true, dashboards: [], activeId: null }));
    renderSwitcher([]);
    expect(screen.getByTestId('screen-loading')).toBeTruthy();
  });

  it('shows the shell error state with a Retry that refetches', () => {
    const refetch = jest.fn();
    mockUseDashboards.mockReturnValue(loaded({ isError: true, error: new Error('nope'), refetch }));
    renderSwitcher([]);
    expect(screen.getByTestId('screen-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('screen-error-retry'));
    expect(refetch).toHaveBeenCalled();
  });
});
