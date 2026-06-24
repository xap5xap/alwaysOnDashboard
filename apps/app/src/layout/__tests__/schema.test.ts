// The one validation layer (AOD-25) for the persisted layout jsonb (data-model §5.5). Valid blobs
// pass; malformed ones are rejected before they reach the engine or the database.
import {
  LayoutRectSchema,
  RefreshIntervalSchema,
  WidgetConfigSchema,
  WidgetSizeSchema,
} from '../schema';

describe('LayoutRectSchema', () => {
  it('accepts a valid rect and strips unknown keys', () => {
    expect(LayoutRectSchema.parse({ x: 0, y: 0, w: 2, h: 1, z: 0, bogus: 9 })).toEqual({
      x: 0,
      y: 0,
      w: 2,
      h: 1,
      z: 0,
    });
  });

  it('rejects non-finite coordinates', () => {
    expect(LayoutRectSchema.safeParse({ x: NaN, y: 0, w: 1, h: 1, z: 0 }).success).toBe(false);
    expect(LayoutRectSchema.safeParse({ x: Infinity, y: 0, w: 1, h: 1, z: 0 }).success).toBe(false);
  });

  it('rejects non-positive width/height', () => {
    expect(LayoutRectSchema.safeParse({ x: 0, y: 0, w: 0, h: 1, z: 0 }).success).toBe(false);
    expect(LayoutRectSchema.safeParse({ x: 0, y: 0, w: 1, h: -3, z: 0 }).success).toBe(false);
  });

  it('rejects a missing field', () => {
    expect(LayoutRectSchema.safeParse({ x: 0, y: 0, w: 1, h: 1 }).success).toBe(false);
  });
});

describe('RefreshIntervalSchema', () => {
  it('accepts a positive-second cadence and "manual"', () => {
    expect(RefreshIntervalSchema.parse({ seconds: 300 })).toEqual({ seconds: 300 });
    expect(RefreshIntervalSchema.parse('manual')).toBe('manual');
  });

  it('rejects zero/negative seconds and unknown literals', () => {
    expect(RefreshIntervalSchema.safeParse({ seconds: 0 }).success).toBe(false);
    expect(RefreshIntervalSchema.safeParse({ seconds: -5 }).success).toBe(false);
    expect(RefreshIntervalSchema.safeParse('auto').success).toBe(false);
  });
});

describe('WidgetSizeSchema', () => {
  it('accepts the five size classes', () => {
    for (const size of ['small', 'medium', 'large', 'wide', 'tall']) {
      expect(WidgetSizeSchema.parse(size)).toBe(size);
    }
  });

  it('rejects an unknown class', () => {
    expect(WidgetSizeSchema.safeParse('huge').success).toBe(false);
  });
});

describe('WidgetConfigSchema', () => {
  it('accepts a plain object of opaque values', () => {
    expect(WidgetConfigSchema.parse({ projectId: 'abc', count: 3 })).toEqual({
      projectId: 'abc',
      count: 3,
    });
  });
});
