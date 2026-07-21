// Component band: the single "chrome awake" idle state (AOD-142; design "The sky fills in" §1e). These lock
// the wake/sink STATE MACHINE — a touch wakes it, the idle window sinks it, and any touch before the window
// re-arms it (the one mechanism that keeps it awake while you arrange and sinks it when you only glance).
// The reanimated fade the dial paints from `awake` is device (AOD-190); the boolean is the contract, so
// fake timers drive it deterministically.
import { renderHook, act } from '@testing-library/react-native';
import { CHROME_IDLE_MS, useChromeAwake } from '../useChromeAwake';

describe('useChromeAwake §1e', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts awake (arriving on the screen is the first interaction)', () => {
    const { result } = renderHook(() => useChromeAwake());
    expect(result.current.awake).toBe(true);
  });

  it('sinks after the idle window with no touch', () => {
    const { result } = renderHook(() => useChromeAwake());
    act(() => {
      jest.advanceTimersByTime(CHROME_IDLE_MS);
    });
    expect(result.current.awake).toBe(false);
  });

  it('wake() re-wakes a sunk dial and re-arms the countdown', () => {
    const { result } = renderHook(() => useChromeAwake());
    act(() => {
      jest.advanceTimersByTime(CHROME_IDLE_MS);
    });
    expect(result.current.awake).toBe(false);

    act(() => {
      result.current.wake();
    });
    expect(result.current.awake).toBe(true);

    // Just short of the window: still awake.
    act(() => {
      jest.advanceTimersByTime(CHROME_IDLE_MS - 1);
    });
    expect(result.current.awake).toBe(true);
    // Cross it: sinks.
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.awake).toBe(false);
  });

  it('a touch before the window RESETS the timer, so it never sinks (the Arrange "keep interacting" case)', () => {
    const { result } = renderHook(() => useChromeAwake());
    // Poke every 4s: each wake re-arms the 5s countdown, so it stays awake indefinitely — one mechanism,
    // no Arrange special-case.
    for (let i = 0; i < 5; i++) {
      act(() => {
        jest.advanceTimersByTime(4000);
      });
      act(() => {
        result.current.wake();
      });
      expect(result.current.awake).toBe(true);
    }
  });

  it('honours a custom idle window', () => {
    const { result } = renderHook(() => useChromeAwake(1000));
    act(() => {
      jest.advanceTimersByTime(999);
    });
    expect(result.current.awake).toBe(true);
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.awake).toBe(false);
  });

  it('clears the pending sink on unmount (no timer fires into an unmounted tree)', () => {
    const { unmount } = renderHook(() => useChromeAwake());
    unmount();
    // If the countdown were not cleared, advancing would fire setState on an unmounted hook.
    expect(() => {
      act(() => {
        jest.advanceTimersByTime(CHROME_IDLE_MS);
      });
    }).not.toThrow();
  });
});
