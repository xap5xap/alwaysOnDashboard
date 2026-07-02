// The exit affordance (design-kiosk-wall.md §7): the invisible corner, the reveal-on-touch hint + ring,
// the deliberate hold, and the PIN pad where a wrong PIN keeps the wall active and a correct PIN exits.
// Exercises the component + useExitFlow + pin.ts together. The AOD-79 block covers the OS-bar-safe
// anchoring: the corner + reveal sit INSIDE rt.insets (the unistyles mock exposes the same mutable
// UnistylesRuntime.insets object useUnistyles returns as rt.insets, so tests can set a Fire-OS-shaped
// inset and assert the anchors move with it).
import React from 'react';
import { StyleSheet } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { darkTheme } from '../../../unistyles';
import { ExitAffordance } from '../ExitAffordance';
import { hashPin } from '../pin';

describe('ExitAffordance §7', () => {
  const stored = hashPin('1234');

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('is invisible at rest: the corner exists but no hint and no PIN pad', () => {
    render(<ExitAffordance storedHash={stored} onExit={jest.fn()} holdMs={2000} />);
    expect(screen.getByTestId('kiosk-exit-corner')).toBeTruthy();
    expect(screen.queryByTestId('kiosk-hold-hint')).toBeNull();
    expect(screen.queryByTestId('kiosk-pin-dots')).toBeNull();
  });

  it('touch-down reveals the "Hold to exit" hint + ring; releasing early cancels', () => {
    render(<ExitAffordance storedHash={stored} onExit={jest.fn()} holdMs={2000} />);
    fireEvent(screen.getByTestId('kiosk-exit-corner'), 'pressIn');
    expect(screen.getByTestId('kiosk-hold-hint')).toBeTruthy();
    expect(screen.getByTestId('kiosk-hold-ring')).toBeTruthy();
    expect(screen.getByText('Hold to exit')).toBeTruthy();
    fireEvent(screen.getByTestId('kiosk-exit-corner'), 'pressOut');
    expect(screen.queryByTestId('kiosk-hold-hint')).toBeNull();
    expect(screen.queryByTestId('kiosk-pin-dots')).toBeNull(); // an early release never opens the PIN
  });

  it('a completed hold (holdMs) opens the PIN pad', () => {
    render(<ExitAffordance storedHash={stored} onExit={jest.fn()} holdMs={2000} />);
    fireEvent(screen.getByTestId('kiosk-exit-corner'), 'pressIn');
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('kiosk-pin-dots')).toBeTruthy();
    expect(screen.getByText('Enter PIN')).toBeTruthy();
  });

  it('a wrong PIN keeps the wall active (no exit, pad stays); a correct PIN exits', () => {
    const onExit = jest.fn();
    render(<ExitAffordance storedHash={stored} onExit={onExit} holdMs={2000} />);
    fireEvent(screen.getByTestId('kiosk-exit-corner'), 'pressIn');
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // wrong: 9 9 9 9 -> cleared, no exit, pad still open
    for (let i = 0; i < 4; i++) fireEvent.press(screen.getByTestId('kiosk-pin-key-9'));
    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByTestId('kiosk-pin-dots')).toBeTruthy();

    // correct: 1 2 3 4 -> exit
    for (const d of ['1', '2', '3', '4']) fireEvent.press(screen.getByTestId(`kiosk-pin-key-${d}`));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('the backspace deletes a digit; the cancel dismisses the pad', () => {
    const onExit = jest.fn();
    render(<ExitAffordance storedHash={stored} onExit={onExit} holdMs={2000} />);
    fireEvent(screen.getByTestId('kiosk-exit-corner'), 'pressIn');
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    fireEvent.press(screen.getByTestId('kiosk-pin-key-1'));
    fireEvent.press(screen.getByTestId('kiosk-pin-key-2'));
    fireEvent.press(screen.getByTestId('kiosk-pin-delete')); // back to just "1"
    fireEvent.press(screen.getByTestId('kiosk-pin-cancel'));
    expect(screen.queryByTestId('kiosk-pin-dots')).toBeNull(); // dismissed back to the wall
    expect(onExit).not.toHaveBeenCalled();
  });

  describe('the OS-bar-safe anchoring (AOD-79)', () => {
    const flatten = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

    afterEach(() => {
      Object.assign(UnistylesRuntime.insets, { top: 0, left: 0, right: 0, bottom: 0 });
    });

    it('zero insets (web / no OS bars): the corner sits at the true screen edge', () => {
      render(<ExitAffordance storedHash={stored} onExit={jest.fn()} holdMs={2000} />);
      const corner = flatten('kiosk-exit-corner');
      expect(corner.right).toBe(0);
      expect(corner.bottom).toBe(0);
      expect(corner.width).toBe(darkTheme.wall.exitCorner); // the token, not resized (test-locked in wall-tokens)
      expect(corner.height).toBe(darkTheme.wall.exitCorner);
    });

    it('OS-bar insets (the Fire OS nav bar): the corner AND the reveal anchor inside them', () => {
      Object.assign(UnistylesRuntime.insets, { bottom: 64, right: 8 });
      render(<ExitAffordance storedHash={stored} onExit={jest.fn()} holdMs={2000} />);

      const corner = flatten('kiosk-exit-corner');
      expect(corner.bottom).toBe(64); // fully above the nav bar, the whole 56dp square holdable
      expect(corner.right).toBe(8);

      fireEvent(screen.getByTestId('kiosk-exit-corner'), 'pressIn');
      const reveal = flatten('kiosk-hold-reveal');
      expect(reveal.bottom).toBe(darkTheme.spacing(4) + 64); // the §7 spacing(4) offset, inset-shifted
      expect(reveal.right).toBe(darkTheme.spacing(4) + 8);
      expect(screen.getByTestId('kiosk-hold-hint')).toBeTruthy(); // the hint still reveals on touch-down
    });
  });
});
