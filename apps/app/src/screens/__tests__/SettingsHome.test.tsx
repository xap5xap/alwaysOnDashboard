// Settings home (design-core-navigation.md §6): the settings-home SHELL. Proves the pushed header, the
// Themes / Kiosk Gate lock rows (Free -> paywall, Pro -> enabled nav row), and the Account nav row. The
// Connections interior is AOD-28's, so ConnectionsList is stubbed here (this test asserts the shell chrome).
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PRO_ENTITLEMENT_ID } from '@vela/shared';
import { CustomerInfoProvider } from '../../entitlements/CustomerInfoContext';

jest.mock('../../connections/ConnectionsList', () => ({ ConnectionsList: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

import { router } from 'expo-router';
import { Settings } from '../Settings';

function renderSettings(activeEntitlementIds: string[]) {
  return render(
    <CustomerInfoProvider value={{ activeEntitlementIds }}>
      <Settings />
    </CustomerInfoProvider>,
  );
}

describe('Settings home §6', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the pushed header and routes the Account nav row', () => {
    renderSettings([]);
    expect(screen.getByText('Settings')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-account'));
    expect(router.push).toHaveBeenCalledWith('/settings/account');
  });

  it('Free: Themes + Kiosk are LOCKED rows routing to the paywall with the matching trigger', () => {
    renderSettings([]);
    expect(screen.getByTestId('settings-themes-locked')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-kiosk-locked'));
    expect(router.push).toHaveBeenCalledWith('/paywall?trigger=kiosk');
  });

  it('Pro: Themes + Kiosk are enabled nav rows (no lock), routing to their screens', () => {
    renderSettings([PRO_ENTITLEMENT_ID]);
    expect(screen.queryByTestId('settings-kiosk-locked')).toBeNull();
    fireEvent.press(screen.getByTestId('settings-themes'));
    expect(router.push).toHaveBeenCalledWith('/settings/themes');
  });
});
