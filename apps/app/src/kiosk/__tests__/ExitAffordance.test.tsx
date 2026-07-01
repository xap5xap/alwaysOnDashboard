// The exit affordance (design-kiosk-wall.md §7): the invisible corner, the reveal-on-touch hint + ring,
// the deliberate hold, and the PIN pad where a wrong PIN keeps the wall active and a correct PIN exits.
// Exercises the component + useExitFlow + pin.ts together.
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
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
});
