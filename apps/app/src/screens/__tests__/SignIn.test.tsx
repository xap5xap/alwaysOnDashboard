// The Sign In interior (design-onboarding-screens.md §3, AOD-29). Proves the sign-in / sign-up MODE TOGGLE
// (one card, two modes, not a second screen), the in-button busy spinner, the quiet error line, and that
// each mode calls the matching auth fn with a trimmed email.
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

let deferredResolve: (v: { error?: string }) => void;
const mockSignIn = jest.fn(() => new Promise<{ error?: string }>((resolve) => (deferredResolve = resolve)));
const mockSignUp = jest.fn(() => Promise.resolve<{ error?: string }>({ error: undefined }));
jest.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ signInWithPassword: mockSignIn, signUpWithPassword: mockSignUp }),
}));
jest.mock('../../supabase/env', () => ({ isSupabaseConfigured: true }));

import { SignIn } from '../SignIn';

describe('SignIn interior §3', () => {
  beforeEach(() => jest.clearAllMocks());

  it('defaults to sign-in mode with the sign-up toggle', () => {
    render(<SignIn />);
    expect(screen.getByText('Sign in to your dashboard')).toBeTruthy();
    expect(screen.getByText('Sign in')).toBeTruthy();
    expect(screen.getByText('Create an account')).toBeTruthy();
  });

  it('the "Create an account" toggle flips the card to sign-up mode (not a new screen)', () => {
    render(<SignIn />);
    fireEvent.press(screen.getByTestId('signin-toggle-mode'));
    expect(screen.getByText('Create your account')).toBeTruthy();
    expect(screen.getByText('Create account')).toBeTruthy();
    expect(screen.getByText('Sign in instead')).toBeTruthy();
  });

  it('submits sign-in with a trimmed email and shows the in-button spinner while busy', async () => {
    render(<SignIn />);
    fireEvent.changeText(screen.getByTestId('signin-email'), '  dev@vela.test  ');
    fireEvent.changeText(screen.getByTestId('signin-password'), 'secret1');
    fireEvent.press(screen.getByTestId('signin-submit'));
    expect(mockSignIn).toHaveBeenCalledWith('dev@vela.test', 'secret1');
    expect(screen.getByTestId('button-spinner')).toBeTruthy();
    await act(async () => deferredResolve({ error: undefined }));
    await waitFor(() => expect(screen.queryByTestId('button-spinner')).toBeNull());
  });

  it('sign-up mode submits through signUpWithPassword', () => {
    render(<SignIn />);
    fireEvent.press(screen.getByTestId('signin-toggle-mode'));
    fireEvent.changeText(screen.getByTestId('signin-email'), 'new@vela.test');
    fireEvent.changeText(screen.getByTestId('signin-password'), 'secret1');
    fireEvent.press(screen.getByTestId('signin-submit'));
    expect(mockSignUp).toHaveBeenCalledWith('new@vela.test', 'secret1');
  });

  it('renders the auth error as a quiet line', async () => {
    render(<SignIn />);
    fireEvent.press(screen.getByTestId('signin-submit'));
    await act(async () => deferredResolve({ error: 'Invalid login credentials' }));
    expect(screen.getByTestId('signin-error')).toBeTruthy();
    expect(screen.getByText('Invalid login credentials')).toBeTruthy();
  });
});
