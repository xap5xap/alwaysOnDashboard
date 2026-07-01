// Account (design-core-navigation.md §6). Proves the shell-owned Account screen: the identity block (email
// + plan, Upgrade while Free), the RELOCATED sign out (§12 drift 1), and the destructive delete control.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PRO_ENTITLEMENT_ID } from '@vela/shared';
import { CustomerInfoProvider } from '../../entitlements/CustomerInfoContext';

// jest.mock factories are hoisted above the file body, so a referenced var must be `mock`-prefixed.
const mockSignOut = jest.fn();
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { email: 'user@vela.app' } }, signOut: mockSignOut }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

import { router } from 'expo-router';
import { Account } from '../Account';

function renderAccount(activeEntitlementIds: string[]) {
  return render(
    <CustomerInfoProvider value={{ activeEntitlementIds }}>
      <Account />
    </CustomerInfoProvider>,
  );
}

describe('Account §6', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the identity (email + Free plan) with an Upgrade action while Free', () => {
    renderAccount([]);
    expect(screen.getByText('user@vela.app')).toBeTruthy();
    expect(screen.getByText('Free plan')).toBeTruthy();
    expect(screen.getByTestId('account-upgrade')).toBeTruthy();
  });

  it('Pro: shows the Pro plan and no Upgrade action', () => {
    renderAccount([PRO_ENTITLEMENT_ID]);
    expect(screen.getByText('Pro plan')).toBeTruthy();
    expect(screen.queryByTestId('account-upgrade')).toBeNull();
  });

  it('sign out is relocated here and fires signOut (§12 drift 1)', () => {
    renderAccount([]);
    fireEvent.press(screen.getByTestId('account-sign-out'));
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('places the destructive delete control', () => {
    renderAccount([]);
    expect(screen.getByTestId('account-delete')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });
});
