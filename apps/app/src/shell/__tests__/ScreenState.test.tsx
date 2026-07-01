// The screen-level states (design-core-navigation.md §8): a WHOLE surface loading / empty / error, distinct
// from the AOD-37 per-widget lifecycle. Loading is a shaped skeleton (not a spinner); empty is a calm CTA;
// error is an alert glyph + a muted line + one Retry action.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState, ErrorState, LoadingState } from '../ScreenState';

describe('LoadingState §8', () => {
  it('renders a shaped skeleton, not a spinner', () => {
    render(<LoadingState />);
    expect(screen.getByTestId('screen-loading')).toBeTruthy();
    expect(screen.getByTestId('skeleton')).toBeTruthy();
  });
});

describe('EmptyState §8', () => {
  it('renders the calm line + a primary action that fires', () => {
    const onAction = jest.fn();
    render(<EmptyState line="Your dashboard is empty." actionLabel="Add widget" onAction={onAction} />);
    expect(screen.getByText('Your dashboard is empty.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('screen-empty-action'));
    expect(onAction).toHaveBeenCalled();
  });

  it('omits the action when no label is given', () => {
    render(<EmptyState line="Nothing here." />);
    expect(screen.queryByTestId('screen-empty-action')).toBeNull();
  });
});

describe('ErrorState §8', () => {
  it('renders the alert glyph + line + a Retry that fires', () => {
    const onRetry = jest.fn();
    render(<ErrorState line="Could not load." onRetry={onRetry} />);
    expect(screen.getByTestId('alert-glyph')).toBeTruthy();
    expect(screen.getByText('Could not load.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('screen-error-retry'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('omits Retry when no onRetry is given', () => {
    render(<ErrorState line="Broken." />);
    expect(screen.queryByTestId('screen-error-retry')).toBeNull();
  });
});
