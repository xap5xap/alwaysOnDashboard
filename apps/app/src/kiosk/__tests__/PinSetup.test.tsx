// The first-run exit-PIN setup (AOD-73, kiosk-mode.md §4.3): enter a 4-digit PIN then confirm it. A matching
// confirm hands the plaintext up (the runtime hashes + persists it); a mismatch shakes and restarts from the
// first entry without persisting; Cancel leaves the wall so the owner is never trapped pre-setup.
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { PinSetup } from '../PinSetup';

const type = (pin: string) => {
  for (const d of pin) fireEvent.press(screen.getByTestId(`kiosk-setpin-key-${d}`));
};

describe('PinSetup §4.3', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('enter then a matching confirm calls onDone with the PIN', () => {
    const onDone = jest.fn();
    render(<PinSetup onDone={onDone} onCancel={jest.fn()} />);
    expect(screen.getByText('Set exit PIN')).toBeTruthy();

    type('1234'); // first entry -> moves to confirm
    expect(screen.getByText('Confirm exit PIN')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();

    type('1234'); // matching confirm
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('1234');
  });

  it('a mismatched confirm does not persist and restarts from the first entry', () => {
    const onDone = jest.fn();
    render(<PinSetup onDone={onDone} onCancel={jest.fn()} />);

    type('1234');
    type('1235'); // mismatch
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('Set exit PIN')).toBeTruthy(); // back to the first step
    expect(screen.getByText('PINs did not match. Try again.')).toBeTruthy();
  });

  it('Cancel leaves the wall without setting a PIN', () => {
    const onCancel = jest.fn();
    render(<PinSetup onDone={jest.fn()} onCancel={onCancel} />);
    fireEvent.press(screen.getByTestId('kiosk-setpin-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
