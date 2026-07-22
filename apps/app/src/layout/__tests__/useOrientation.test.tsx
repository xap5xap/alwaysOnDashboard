// The device orientation hook (AOD-197, design §4/§6). These lock the width>=height mapping the handheld
// surfaces use to request + commit a per-orientation layout, and its reactivity (it recomputes from the window
// dimensions, so a rotation re-resolves the surface). Only the deep useWindowDimensions module is mocked (so
// the real react-native / jest-expo preset loads normally and the RN index re-exports the mock), and the dims
// are set exactly per test.
import { renderHook } from '@testing-library/react-native';

const mockUseWindowDimensions = jest.fn();
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: mockUseWindowDimensions,
}));

import { useOrientation } from '../useOrientation';

const dims = (width: number, height: number) => ({ width, height, scale: 2, fontScale: 1 });

beforeEach(() => jest.clearAllMocks());

describe('useOrientation (AOD-197)', () => {
  it('is landscape when width >= height (the wall orientation and default)', () => {
    mockUseWindowDimensions.mockReturnValue(dims(1000, 600));
    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe('landscape');
  });

  it('is portrait when height > width', () => {
    mockUseWindowDimensions.mockReturnValue(dims(600, 1000));
    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe('portrait');
  });

  it('treats a square viewport as landscape (the >= tie-break)', () => {
    mockUseWindowDimensions.mockReturnValue(dims(800, 800));
    const { result } = renderHook(() => useOrientation());
    expect(result.current).toBe('landscape');
  });

  it('re-resolves when the dimensions change (reactive on rotation)', () => {
    mockUseWindowDimensions.mockReturnValue(dims(1000, 600));
    const { result, rerender } = renderHook(() => useOrientation());
    expect(result.current).toBe('landscape');

    // A rotation: useWindowDimensions returns the new size, so the next render flips the orientation.
    mockUseWindowDimensions.mockReturnValue(dims(600, 1000));
    rerender({});
    expect(result.current).toBe('portrait');
  });
});
