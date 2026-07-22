// The one validation layer (AOD-25) for the persisted layout jsonb (data-model §5.5). Valid blobs
// pass; malformed ones are rejected before they reach the engine or the database.
import {
  DB_WIDGET_SIZES,
  DbWidgetSizeSchema,
  LayoutRectSchema,
  PerOrientationRectSchema,
  RefreshIntervalSchema,
  StoredRectSchema,
  WidgetConfigSchema,
  WidgetSizeSchema,
  normalizeStoredRect,
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

// AOD-197: the per-orientation stored rect. The persisted rect grows from the legacy bare {x,y,w,h,z} to
// {w,h,z,pos:{landscape?,portrait?}} (client-only, no DB migration). These lock the schema, the read-side
// union (new shape OR legacy, malformed rejected), and the legacy -> landscape-designed normalization —
// the data-safety guarantee the whole reshape rests on (no valid instance is ever dropped).
describe('PerOrientationRectSchema (AOD-197 new stored shape)', () => {
  it('accepts a rect with one orientation position and strips unknown keys', () => {
    expect(
      PerOrientationRectSchema.parse({ w: 2, h: 1, z: 0, pos: { landscape: { x: 1, y: 2 } }, bogus: 9 }),
    ).toEqual({ w: 2, h: 1, z: 0, pos: { landscape: { x: 1, y: 2 } } });
  });

  it('accepts BOTH orientation positions (a board designed in both)', () => {
    const both = { w: 1, h: 2, z: 3, pos: { landscape: { x: 4, y: 0 }, portrait: { x: 0, y: 1 } } };
    expect(PerOrientationRectSchema.parse(both)).toEqual(both);
  });

  it('rejects an empty pos (the "at least one orientation designed" invariant)', () => {
    expect(PerOrientationRectSchema.safeParse({ w: 2, h: 1, z: 0, pos: {} }).success).toBe(false);
  });

  it('rejects a non-positive footprint and a non-finite position', () => {
    expect(
      PerOrientationRectSchema.safeParse({ w: 0, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 } } }).success,
    ).toBe(false);
    expect(
      PerOrientationRectSchema.safeParse({ w: 2, h: 1, z: 0, pos: { landscape: { x: NaN, y: 0 } } }).success,
    ).toBe(false);
  });
});

describe('StoredRectSchema (the read-side union: new shape OR legacy bare rect)', () => {
  it('accepts the new per-orientation shape', () => {
    expect(StoredRectSchema.safeParse({ w: 2, h: 1, z: 0, pos: { portrait: { x: 0, y: 0 } } }).success).toBe(
      true,
    );
  });

  it('accepts a legacy bare {x,y,w,h,z} (existing dogfood boards read unchanged)', () => {
    expect(StoredRectSchema.safeParse({ x: 3, y: 4, w: 2, h: 1, z: 0 }).success).toBe(true);
  });

  it('rejects a rect that is NEITHER shape (a pos:{} with no x,y) so the row drops, never overlaps', () => {
    expect(StoredRectSchema.safeParse({ w: 2, h: 1, z: 0, pos: {} }).success).toBe(false);
    expect(StoredRectSchema.safeParse({ w: 2, h: 1, z: 0 }).success).toBe(false);
    expect(StoredRectSchema.safeParse(null).success).toBe(false);
  });
});

describe('normalizeStoredRect (legacy -> landscape-designed; new shape passes through)', () => {
  it('reads a legacy bare rect as LANDSCAPE-designed (x,y -> pos.landscape), no data loss', () => {
    expect(normalizeStoredRect({ x: 5, y: 6, w: 2, h: 1, z: 2 } as never)).toEqual({
      w: 2,
      h: 1,
      z: 2,
      pos: { landscape: { x: 5, y: 6 } },
    });
  });

  it('passes a new-shape rect through, keeping only the present orientations', () => {
    expect(
      normalizeStoredRect({ w: 1, h: 2, z: 0, pos: { portrait: { x: 0, y: 3 } } } as never),
    ).toEqual({ w: 1, h: 2, z: 0, pos: { portrait: { x: 0, y: 3 } } });
    // A landscape-only new-shape rect does NOT gain a phantom portrait key (pos[portrait] stays undefined).
    const norm = normalizeStoredRect({ w: 2, h: 2, z: 1, pos: { landscape: { x: 2, y: 0 } } } as never);
    expect('portrait' in norm.pos).toBe(false);
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

describe('WidgetSizeSchema (the AOD-122 S/M/W/L slot ids)', () => {
  it('accepts the four slot ids', () => {
    for (const size of ['S', 'M', 'W', 'L']) {
      expect(WidgetSizeSchema.parse(size)).toBe(size);
    }
  });

  it('rejects unknown classes AND the retired legacy words (those live only in the DB vocabulary)', () => {
    for (const bad of ['huge', 'small', 'medium', 'large', 'wide', 'tall']) {
      expect(WidgetSizeSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('DbWidgetSizeSchema (the frozen widget_instances CHECK vocabulary, data-model §5.5)', () => {
  it('accepts exactly the five legacy words the DB CHECK allows', () => {
    expect([...DB_WIDGET_SIZES]).toEqual(['small', 'medium', 'large', 'wide', 'tall']);
    for (const size of DB_WIDGET_SIZES) {
      expect(DbWidgetSizeSchema.parse(size)).toBe(size);
    }
  });

  it('rejects the slot ids (the app vocabulary never reaches the column unserialized) and junk', () => {
    for (const bad of ['S', 'M', 'W', 'L', 'huge']) {
      expect(DbWidgetSizeSchema.safeParse(bad).success).toBe(false);
    }
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
