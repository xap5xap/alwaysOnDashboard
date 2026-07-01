// Component band: the dashboards switcher interior (design-dashboard-editor §8). It proves the list marks
// the active dashboard, the maxDashboards create gate (Free -> the AOD-20 LockRow routing to the paywall;
// Pro -> an enabled create action), and the shell loading/error states. useDashboard is mocked (the
// multi-dashboard backing is the build's seam); entitlements are driven through the real CustomerInfoProvider.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PRO_ENTITLEMENT_ID } from '@vela/shared';
import { CustomerInfoProvider } from '../../entitlements/CustomerInfoContext';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('../../layout/useDashboard', () => ({ useDashboard: jest.fn() }));

import { router } from 'expo-router';
import { useDashboard } from '../../layout/useDashboard';
import { DashboardsSwitcher } from '../DashboardsSwitcher';

const mockUseDashboard = useDashboard as jest.Mock;

const loaded = (overrides: Record<string, unknown> = {}) => ({
  instances: [],
  dashboardId: 'dash-1',
  dashboardName: 'Wall',
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  commit: jest.fn(),
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
  mockUseDashboard.mockReturnValue(loaded());
});

describe('Dashboards switcher §8', () => {
  it('lists the active dashboard by name and marks it active', () => {
    renderSwitcher([]);
    expect(screen.getByText('Wall')).toBeTruthy();
    expect(screen.getByTestId('dashboard-row-dash-1').props.accessibilityState).toMatchObject({ selected: true });
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

  it('dismisses on back (the modal-route Close)', () => {
    renderSwitcher([]);
    fireEvent.press(screen.getByTestId('appbar-back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('shows the shell loading state while the dashboard loads', () => {
    mockUseDashboard.mockReturnValue(loaded({ isLoading: true, dashboardId: null, dashboardName: null }));
    renderSwitcher([]);
    expect(screen.getByTestId('screen-loading')).toBeTruthy();
  });

  it('shows the shell error state with a Retry that refetches', () => {
    const refetch = jest.fn();
    mockUseDashboard.mockReturnValue(loaded({ isError: true, error: new Error('nope'), refetch }));
    renderSwitcher([]);
    expect(screen.getByTestId('screen-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('screen-error-retry'));
    expect(refetch).toHaveBeenCalled();
  });
});
