// The AOD-75 dogfood grant: EXPO_PUBLIC_DEV_ENTITLEMENTS=pro seeds the CustomerInfoProvider's
// INITIAL ids in internal builds only. Covers the grant function (exact-match "pro"), the provider
// seam (granted when set, byte-identical FREE default when unset), the injected-value precedence
// the tests rely on, and that a real CustomerInfo update (the PurchasesBridge setter path) still
// overrides the grant.
import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { PRO_ENTITLEMENT_ID } from '@vela/shared';
import { Gate } from '../Gate';
import { CustomerInfoProvider, useSetCustomerInfo } from '../CustomerInfoContext';
import { devGrantedEntitlementIds } from '../devEntitlements';

const ENV_KEY = 'EXPO_PUBLIC_DEV_ENTITLEMENTS';
const envBefore = process.env[ENV_KEY];

afterEach(() => {
  if (envBefore === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = envBefore;
});

function setEnv(value: string | undefined) {
  if (value === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = value;
}

describe('devGrantedEntitlementIds (AOD-75)', () => {
  it('grants the pro entitlement only for the exact value "pro"', () => {
    setEnv('pro');
    expect(devGrantedEntitlementIds()).toEqual([PRO_ENTITLEMENT_ID]);
  });

  it('grants nothing when unset or set to any other value', () => {
    setEnv(undefined);
    expect(devGrantedEntitlementIds()).toEqual([]);
    for (const value of ['', 'PRO', 'true', '1']) {
      setEnv(value);
      expect(devGrantedEntitlementIds()).toEqual([]);
    }
  });
});

let latestSetCustomerInfo: (activeEntitlementIds: string[]) => void = () => {};
function CaptureSetter() {
  latestSetCustomerInfo = useSetCustomerInfo();
  return null;
}

function renderGate(value?: { activeEntitlementIds: string[] }) {
  return render(
    <CustomerInfoProvider value={value}>
      <CaptureSetter />
      <Gate feature="canUseKiosk" fallback={<Text>Kiosk is Pro</Text>}>
        <Text>Kiosk Mode</Text>
      </Gate>
    </CustomerInfoProvider>,
  );
}

describe('CustomerInfoProvider dogfood grant seam (AOD-75)', () => {
  it('stays FREE (locked) when the override is unset', () => {
    setEnv(undefined);
    renderGate();
    expect(screen.getByText('Kiosk is Pro')).toBeTruthy();
    expect(screen.queryByText('Kiosk Mode')).toBeNull();
  });

  it('seeds PRO (unlocked) when the override is set', () => {
    setEnv('pro');
    renderGate();
    expect(screen.getByText('Kiosk Mode')).toBeTruthy();
    expect(screen.queryByText('Kiosk is Pro')).toBeNull();
  });

  it('an injected value wins over the grant (tests stay deterministic)', () => {
    setEnv('pro');
    renderGate({ activeEntitlementIds: [] });
    expect(screen.getByText('Kiosk is Pro')).toBeTruthy();
  });

  it('a real CustomerInfo update still overrides the grant (purchase/restore wins)', () => {
    setEnv('pro');
    renderGate();
    expect(screen.getByText('Kiosk Mode')).toBeTruthy();
    act(() => latestSetCustomerInfo([])); // the SDK reports no active entitlements
    expect(screen.getByText('Kiosk is Pro')).toBeTruthy();
    expect(screen.queryByText('Kiosk Mode')).toBeNull();
  });
});
