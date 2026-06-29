// The ambient signal context (design-widget-system.md §7, AOD-10 §8): useAmbient() defaults to full day
// with no provider, and the provider carries a controlled value (the seam AOD-11's kiosk runtime drives).
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { AmbientProvider, useAmbient, AMBIENT_DAY } from '../AmbientContext';

describe('AmbientContext (AOD-37 §7)', () => {
  it('defaults to full day when no provider is mounted', () => {
    const { result } = renderHook(() => useAmbient());
    expect(result.current).toEqual(AMBIENT_DAY);
    expect(result.current).toEqual({ phase: 'day', dimLevel: 0 });
  });

  it('returns the controlled value from the provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AmbientProvider value={{ phase: 'night', dimLevel: 0.7 }}>{children}</AmbientProvider>
    );
    const { result } = renderHook(() => useAmbient(), { wrapper });
    expect(result.current).toEqual({ phase: 'night', dimLevel: 0.7 });
  });

  it('an uncontrolled provider defaults to day', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <AmbientProvider>{children}</AmbientProvider>;
    const { result } = renderHook(() => useAmbient(), { wrapper });
    expect(result.current).toEqual(AMBIENT_DAY);
  });
});
