// The onboarding first-run sequence (design-onboarding-screens.md §4/§5, AOD-29). Proves the guided
// welcome -> connect -> finish flow, the skip path (persists onboarded + replaces into the dashboard), that
// the connect step composes the AOD-70 connections surface, and the success transition when a service
// connects during onboarding. The connections stack + registry are mocked; the flow logic is the subject.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn() } }));

const mockSetOnboarded = jest.fn();
jest.mock('../onboardedStore', () => ({ setOnboarded: (v: boolean) => mockSetOnboarded(v) }));

// Compose, do not rebuild: the connect step renders the real AOD-70 ConnectionsList, stubbed here.
jest.mock('../../connections/ConnectionsList', () => ({ ConnectionsList: () => null }));

const mockUseConnections = jest.fn();
jest.mock('../../connections/useConnections', () => ({ useConnections: () => mockUseConnections() }));
jest.mock('../../registry/RegistryProvider', () => ({
  useRegistry: () => ({ connectableServices: () => [{ id: 'linear', displayName: 'Linear' }] }),
}));

import { router } from 'expo-router';
import { Onboarding } from '../Onboarding';

const mockReplace = router.replace as jest.Mock;
const noConnections = { connections: new Map(), isLoading: false, isError: false, error: null };
const linearConnected = {
  connections: new Map([['linear', { service: 'linear', status: 'connected' }]]),
  isLoading: false,
  isError: false,
  error: null,
};

describe('Onboarding sequence §4/§5', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseConnections.mockReturnValue(noConnections);
  });

  it('opens on the welcome step with the wordmark, tagline, and get-started / skip', () => {
    render(<Onboarding />);
    expect(screen.getByTestId('onboarding-welcome')).toBeTruthy();
    expect(screen.getByText('vela')).toBeTruthy();
    expect(screen.getByText('Always on. Never loud.')).toBeTruthy();
    expect(screen.getByTestId('onboarding-get-started')).toBeTruthy();
  });

  it('Get started advances to the connect step composing the connections surface', () => {
    render(<Onboarding />);
    fireEvent.press(screen.getByTestId('onboarding-get-started'));
    expect(screen.getByTestId('onboarding-connect')).toBeTruthy();
    expect(screen.getByText('Connect your first service.')).toBeTruthy();
  });

  it('Skip for now persists the onboarded flag and replaces into the dashboard', () => {
    render(<Onboarding />);
    fireEvent.press(screen.getByTestId('onboarding-skip'));
    expect(mockSetOnboarded).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('advances to the success step when a service connects during onboarding', () => {
    const { rerender } = render(<Onboarding />);
    fireEvent.press(screen.getByTestId('onboarding-get-started')); // baseline: nothing connected
    mockUseConnections.mockReturnValue(linearConnected);
    rerender(<Onboarding />);
    expect(screen.getByTestId('onboarding-finish')).toBeTruthy();
    expect(screen.getByText('Linear connected.')).toBeTruthy();
    expect(screen.getByTestId('onboarding-go-dashboard')).toBeTruthy();
  });

  it('finishing from the success step persists onboarded + replaces into the dashboard', () => {
    const { rerender } = render(<Onboarding />);
    fireEvent.press(screen.getByTestId('onboarding-get-started'));
    mockUseConnections.mockReturnValue(linearConnected);
    rerender(<Onboarding />);
    fireEvent.press(screen.getByTestId('onboarding-go-dashboard'));
    expect(mockSetOnboarded).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  });
});
