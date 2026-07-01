// The paywall body (design-onboarding-screens.md §6/§7, AOD-29). Proves the body (trial lead, the AOD-12 §4
// value props, both packages, the CTAs) composes the AOD-67 Sheet, the per-trigger lead varies while the
// body is identical, and the CTAs drive the real purchase seam (purchase / restore) then dismiss. The
// RevenueCat seam + router are mocked; the visual + interaction contract is the subject.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

const mockPurchase = jest.fn((_id: string) => Promise.resolve({ activeEntitlementIds: ['pro'] }));
const mockRestore = jest.fn(() => Promise.resolve({ activeEntitlementIds: [] as string[] }));
const mockGetPackages = jest.fn(() =>
  Promise.resolve([
    { id: 'annual', priceString: '$39.99', period: 'year' },
    { id: 'monthly', priceString: '$5.99', period: 'month' },
  ]),
);
jest.mock('../../entitlements/purchases', () => ({
  purchases: {
    configure: () => {},
    isConfigured: () => true,
    getPackages: () => mockGetPackages(),
    purchase: (id: string) => mockPurchase(id),
    restore: () => mockRestore(),
    addListener: () => () => {},
  },
}));

import { router, useLocalSearchParams } from 'expo-router';
import { Paywall } from '../Paywall';

const mockBack = router.back as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

describe('Paywall body §6/§7', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({});
  });

  it('leads with the 7-day trial and renders the value props + both packages inside the Sheet', async () => {
    render(<Paywall />);
    await waitFor(() => expect(mockGetPackages).toHaveBeenCalled());
    expect(screen.getByTestId('sheet-grabber')).toBeTruthy(); // composes the AOD-67 Sheet
    expect(screen.getByText('Try everything free for 7 days.')).toBeTruthy();
    expect(screen.getByText('Kiosk Mode')).toBeTruthy();
    expect(screen.getByTestId('paywall-package-annual')).toBeTruthy();
    expect(screen.getByTestId('paywall-package-monthly')).toBeTruthy();
    expect(screen.getByTestId('paywall-start-trial')).toBeTruthy();
    expect(screen.getByTestId('paywall-restore')).toBeTruthy();
  });

  it('varies only the lead by trigger (kiosk)', async () => {
    mockUseLocalSearchParams.mockReturnValue({ trigger: 'kiosk' });
    render(<Paywall />);
    expect(screen.getByText('Kiosk Mode turns this device into an always-on wall display.')).toBeTruthy();
    expect(screen.queryByText('Try everything free for 7 days.')).toBeNull();
    // the body is identical regardless of trigger
    expect(screen.getByTestId('paywall-package-annual')).toBeTruthy();
  });

  it('Start 7-day free trial purchases the selected (annual by default) package then dismisses', async () => {
    render(<Paywall />);
    fireEvent.press(screen.getByTestId('paywall-start-trial'));
    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith('annual'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('selecting the monthly package purchases monthly', async () => {
    render(<Paywall />);
    fireEvent.press(screen.getByTestId('paywall-package-monthly'));
    fireEvent.press(screen.getByTestId('paywall-start-trial'));
    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith('monthly'));
  });

  it('Restore with no purchases surfaces a quiet message and does not dismiss', async () => {
    render(<Paywall />);
    fireEvent.press(screen.getByTestId('paywall-restore'));
    expect(await screen.findByText('No purchases to restore.')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('Maybe later dismisses to the caller', async () => {
    render(<Paywall />);
    fireEvent.press(screen.getByTestId('paywall-maybe-later'));
    expect(mockBack).toHaveBeenCalled();
  });
});
