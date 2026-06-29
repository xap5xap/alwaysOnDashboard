// The AOD-15 refresh control (design-widget-system.md §6): the presentational states and the
// useManualRefresh state machine that drives them (idle / in-flight / within-floor). Hidden is the host's
// decision (it omits the control for a none widget) and is covered in the host chrome tests.
import React from 'react';
import { fireEvent, render, renderHook, act, screen } from '@testing-library/react-native';
import { RefreshControl } from '../RefreshControl';
import { useManualRefresh } from '../useManualRefresh';

describe('RefreshControl rendering (AOD-37 §6)', () => {
  it('renders the control and reports taps', () => {
    const onPress = jest.fn();
    render(<RefreshControl state="idle" onPress={onPress} />);
    const control = screen.getByTestId('widget-refresh');
    expect(control).toBeTruthy();
    fireEvent.press(control);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('marks itself busy while in-flight (accessibility)', () => {
    render(<RefreshControl state="in-flight" onPress={() => {}} />);
    expect(screen.getByTestId('widget-refresh').props.accessibilityState).toMatchObject({ busy: true });
  });

  it('is not busy when idle or confirming within-floor', () => {
    const { rerender } = render(<RefreshControl state="idle" onPress={() => {}} />);
    expect(screen.getByTestId('widget-refresh').props.accessibilityState).toMatchObject({ busy: false });
    rerender(<RefreshControl state="within-floor" onPress={() => {}} />);
    expect(screen.getByTestId('widget-refresh').props.accessibilityState).toMatchObject({ busy: false });
  });
});

describe('useManualRefresh state machine (AOD-37 §6, widget-model §6.6)', () => {
  it('idle -> in-flight while a user-triggered fetch runs, back to idle when it settles', async () => {
    let resolveFetch: () => void = () => {};
    const refetch = jest.fn(() => new Promise<void>((r) => (resolveFetch = r)));
    const { result } = renderHook(() => useManualRefresh({ refetch, withinFloor: () => false }));

    expect(result.current.state).toBe('idle');

    act(() => result.current.onPress());
    expect(result.current.state).toBe('in-flight');
    expect(refetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch();
      await Promise.resolve();
    });
    expect(result.current.state).toBe('idle');
  });

  it('a tap inside the fetch-floor confirms "within-floor" and makes NO provider call', () => {
    jest.useFakeTimers();
    try {
      const refetch = jest.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useManualRefresh({ refetch, withinFloor: () => true }));

      act(() => result.current.onPress());
      expect(result.current.state).toBe('within-floor');
      expect(refetch).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1200);
      });
      expect(result.current.state).toBe('idle');
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores taps while a manual fetch is already in flight', () => {
    const refetch = jest.fn(() => new Promise<void>(() => {})); // never resolves
    const { result } = renderHook(() => useManualRefresh({ refetch, withinFloor: () => false }));
    act(() => result.current.onPress());
    act(() => result.current.onPress());
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
