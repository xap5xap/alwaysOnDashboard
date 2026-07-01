// Skeleton / badges / lock affordances (design-component-library.md §10, §11).
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Skeleton } from '../Skeleton';
import { StatusBadge, AccentBadge, CountBadge } from '../Badge';
import { LockRow, LockedTile } from '../LockRow';

describe('Skeleton §10', () => {
  it('renders shaped bars (a heading + rows), not a single bar', () => {
    render(<Skeleton rows={3} testID="sk" />);
    expect(screen.getByTestId('sk')).toBeTruthy();
    // 1 heading bar + 3 rows x (1 leading + 2 identity bars) = 10 bars
    expect(screen.getAllByTestId('skeleton-bar').length).toBeGreaterThan(1);
  });
});

describe('Badges §10', () => {
  it('StatusBadge: a coloured dot + an uppercase label', () => {
    render(<StatusBadge status="warning" label="STALE" testID="b" />);
    expect(screen.getByTestId('status-badge-dot')).toBeTruthy();
    expect(screen.getByText('STALE')).toBeTruthy();
  });

  it('AccentBadge: the PRO label', () => {
    render(<AccentBadge label="PRO" testID="pro" />);
    expect(screen.getByText('PRO')).toBeTruthy();
  });

  it('CountBadge: the count value in both tones', () => {
    render(
      <>
        <CountBadge count={12} tone="primary" testID="c1" />
        <CountBadge count={3} tone="neutral" testID="c2" />
      </>,
    );
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});

describe('Lock affordances §11 (the Gate fallback)', () => {
  it('LockRow: the muted title, a PRO badge, and routes to the paywall on press', () => {
    const onPress = jest.fn();
    render(<LockRow title="Kiosk Mode" onPress={onPress} testID="lock" />);
    expect(screen.getByText('Kiosk Mode')).toBeTruthy();
    expect(screen.getByText('PRO')).toBeTruthy();
    fireEvent.press(screen.getByTestId('lock'));
    expect(onPress).toHaveBeenCalled();
  });

  it('LockedTile: shows the preview + a "Pro feature" line + an Upgrade button', () => {
    const onUpgrade = jest.fn();
    render(
      <LockedTile onUpgrade={onUpgrade} testID="tile">
        <Text>Premium preview</Text>
      </LockedTile>,
    );
    expect(screen.getByText('Premium preview')).toBeTruthy();
    expect(screen.getByText('Pro feature')).toBeTruthy();
    fireEvent.press(screen.getByTestId('locked-tile-upgrade'));
    expect(onUpgrade).toHaveBeenCalled();
  });
});
