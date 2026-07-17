// AOD-127: useOnline subscribes to onlineManager (fed by netinfo via setupOnlineManager), so a component and
// the query cache read the same connectivity truth. Driving onlineManager directly here is exactly what a
// netinfo flip does through the wiring (covered in onlineManager.test.ts).
import { renderHook, act } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';
import { useOnline } from '../useOnline';

describe('useOnline', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('reflects the current onlineManager state and re-renders on connectivity flips', () => {
    onlineManager.setOnline(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => {
      onlineManager.setOnline(false);
    });
    expect(result.current).toBe(false);

    act(() => {
      onlineManager.setOnline(true);
    });
    expect(result.current).toBe(true);
  });
});
