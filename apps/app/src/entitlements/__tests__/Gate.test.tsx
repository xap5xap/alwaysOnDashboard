// The client UX-only entitlement gate against a mocked CustomerInfo (AOD-12 §6.5, testing-strategy
// §9): locks a Pro feature for a Free CustomerInfo and unlocks it when the pro entitlement is active.
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { PRO_ENTITLEMENT_ID } from '@vela/shared';
import { Gate } from '../Gate';
import { CustomerInfoProvider } from '../CustomerInfoContext';

function renderGate(activeEntitlementIds: string[]) {
  return render(
    <CustomerInfoProvider value={{ activeEntitlementIds }}>
      <Gate feature="canUseKiosk" fallback={<Text>Kiosk is Pro</Text>}>
        <Text>Kiosk Mode</Text>
      </Gate>
    </CustomerInfoProvider>,
  );
}

describe('Gate (AOD-12 §6.5 UX-only)', () => {
  it('locks a Pro feature for a Free CustomerInfo', () => {
    renderGate([]);
    expect(screen.getByText('Kiosk is Pro')).toBeTruthy();
    expect(screen.queryByText('Kiosk Mode')).toBeNull();
  });

  it('unlocks when the CustomerInfo carries the pro entitlement', () => {
    renderGate([PRO_ENTITLEMENT_ID]);
    expect(screen.getByText('Kiosk Mode')).toBeTruthy();
    expect(screen.queryByText('Kiosk is Pro')).toBeNull();
  });
});
