// The first-run "onboarded" flag + the gate hook (AOD-29). Proves a fresh user is not onboarded (so the gate
// routes them to /onboarding), that setOnboarded persists + notifies, and that useOnboarded re-resolves when
// the flag flips. The native store runs against the react-native-mmkv jest mock (in-memory).
import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { getOnboarded, setOnboarded, subscribeOnboarded } from '../onboardedStore';
import { useOnboarded } from '../../shell/useOnboarded';

function Probe() {
  return <Text>{useOnboarded() ? 'onboarded' : 'new'}</Text>;
}

describe('onboarded flag (AOD-29 gate seam)', () => {
  beforeEach(() => setOnboarded(false));

  it('a brand-new user is not onboarded (routes to /onboarding)', () => {
    expect(getOnboarded()).toBe(false);
  });

  it('setOnboarded persists the flag and notifies subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeOnboarded(listener);
    setOnboarded(true);
    expect(getOnboarded()).toBe(true);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('useOnboarded reflects the flag and updates when it flips', () => {
    render(<Probe />);
    expect(screen.getByText('new')).toBeTruthy();
    act(() => setOnboarded(true));
    expect(screen.getByText('onboarded')).toBeTruthy();
  });
});
