// AOD-81 §3 the wall viewport contract, pinned to the design's section-3 table. This is the single source of
// truth the arrange-mode boundary box (§5) and the wall preview (§6) derive from, so the numbers are the
// contract: a drift here is a drift in what the editor promises the wall will show. Pure math, no device.
import { darkTheme } from '../../../unistyles';
import { UNIT_PX } from '../../layout/geometry';
import {
  landscapeScreen,
  WALL_STEADY_INSETS,
  wallTagLabel,
  wallViewportUnits,
  type Insets,
} from '../viewport';

const TYPE_SCALE = 1.4; // the shipped wall.typeScale (test-locked in wall-tokens.test.ts)

describe('§3 wallViewportUnits: the section-3 reference-window table', () => {
  it('Fire HD 8, steady state (1280x800, insets 0): 11.43 x 7.14u', () => {
    const v = wallViewportUnits({ width: 1280, height: 800 }, WALL_STEADY_INSETS, TYPE_SCALE);
    expect(v.w).toBeCloseTo(11.43, 2);
    expect(v.h).toBeCloseTo(7.14, 2);
  });

  it('REGRESSION PIN — pre-AOD-76 barred frame (1280x800, 64dp nav inset): 11.43 x 6.57u', () => {
    // The height the nav bar stole before AOD-76 reclaimed it; exercises the inset-subtraction path so a
    // future insets bug fails here loudly. The design's §7 history: 800 - 64 = 736 -> 6.57u.
    const barred: Insets = { top: 0, right: 0, bottom: 64, left: 0 };
    const v = wallViewportUnits({ width: 1280, height: 800 }, barred, TYPE_SCALE);
    expect(v.w).toBeCloseTo(11.43, 2);
    expect(v.h).toBeCloseTo(6.57, 2);
  });

  it('412dp-class phone in landscape (915x412, insets 0): 8.17 x 3.68u', () => {
    const v = wallViewportUnits({ width: 915, height: 412 }, WALL_STEADY_INSETS, TYPE_SCALE);
    expect(v.w).toBeCloseTo(8.17, 2);
    expect(v.h).toBeCloseTo(3.68, 2);
  });

  it('is exactly (screen - insets) / (typeScale x UNIT_PX) — the formula, not a hardcoded aspect', () => {
    const screen = { width: 1000, height: 600 };
    const v = wallViewportUnits(screen, WALL_STEADY_INSETS, TYPE_SCALE);
    expect(v.w).toBe(1000 / (TYPE_SCALE * UNIT_PX));
    expect(v.h).toBe(600 / (TYPE_SCALE * UNIT_PX));
  });

  it('derives from the wall.typeScale TOKEN (the one tuning lever, §3): the token reproduces the Fire HD 8 window', () => {
    const v = wallViewportUnits({ width: 1280, height: 800 }, WALL_STEADY_INSETS, darkTheme.wall.typeScale);
    expect(v.w).toBeCloseTo(11.43, 2);
    expect(v.h).toBeCloseTo(7.14, 2);
  });
});

describe('§5 landscapeScreen: the wall is landscape-locked, the long edge is always the width', () => {
  it('turns a portrait editor screen into the landscape wall window', () => {
    expect(landscapeScreen({ width: 800, height: 1280 })).toEqual({ width: 1280, height: 800 });
  });
  it('leaves an already-landscape screen unchanged', () => {
    expect(landscapeScreen({ width: 1280, height: 800 })).toEqual({ width: 1280, height: 800 });
  });
});

describe('§5 wallTagLabel: the device-computed tag, one decimal', () => {
  it('formats the Fire HD 8 window as "WALL · 11.4 x 7.1"', () => {
    const v = wallViewportUnits({ width: 1280, height: 800 }, WALL_STEADY_INSETS, TYPE_SCALE);
    expect(wallTagLabel(v)).toBe('WALL · 11.4 x 7.1');
  });
  it('rounds to one decimal (never the raw float)', () => {
    expect(wallTagLabel({ w: 8.169, h: 3.678 })).toBe('WALL · 8.2 x 3.7');
  });
});

describe('§7 WALL_STEADY_INSETS: the Android/Fire immersive steady state is zero', () => {
  it('is all zero (the full physical screen is the usable region)', () => {
    expect(WALL_STEADY_INSETS).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});
