// AOD-66 value-equivalence guard (design-tokens.md §9): the canonical token set is a strict SUPERSET of
// the shipped theme, so every pre-existing colour MUST resolve byte-identically after the primitive-alias
// restructure. These assertions pin the shipped hexes (the "verbatim" guarantee, §2) and check the
// additive tokens (§4.4 / §5.2 / §7.2). If a future edit drifts a shipped value, this fails loudly.
import { darkTheme, lightTheme, night, primitive } from '../unistyles';

// The shipped hexes, copied from the pre-AOD-66 unistyles.ts (the locked input, §2). Deliberately NOT
// sourced from `primitive` (that would be circular): hard-coded so a typo in a ramp step is caught here.
const SHIPPED_DARK = {
  background: '#0B0B0F',
  surface: '#16161D',
  surfaceAlt: '#1F1F29',
  border: '#2A2A36',
  text: '#F4F4F8',
  textMuted: '#9B9BA8',
  accent: '#6E8BFF',
  skeleton: '#23232E',
  error: '#FF6B6B',
  warning: '#F2B84B',
  success: '#4CB782',
} as const;

const SHIPPED_LIGHT = {
  background: '#F6F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEEEF3',
  border: '#DADAE2',
  text: '#16161D',
  textMuted: '#6B6B78',
  accent: '#3F5BD6',
  skeleton: '#E4E4EC',
  error: '#D64545',
  warning: '#B5791B',
  success: '#2F8F63',
} as const;

const SHIPPED_NIGHT = {
  bg: '#0A0506',
  surface: '#140709',
  border: '#2E1214',
  primary: '#C2362B',
  secondary: '#8A201B',
  muted: '#5E1714',
} as const;

describe('AOD-66 reconciliation: shipped values stay byte-identical (§9 delta 1)', () => {
  it('dark colour roles resolve to the shipped hexes', () => {
    // toMatchObject: the 11 shipped roles match exactly; the additive roles (§4.4) are allowed alongside.
    expect(darkTheme.colors).toMatchObject(SHIPPED_DARK);
  });

  it('light colour roles resolve to the shipped hexes', () => {
    expect(lightTheme.colors).toMatchObject(SHIPPED_LIGHT);
  });

  it('the ambient-night group resolves to the shipped hexes (now aliasing ember.*)', () => {
    expect(night).toEqual(SHIPPED_NIGHT);
    expect(darkTheme.night).toEqual(SHIPPED_NIGHT); // also spread into each theme via sharedTokens
  });

  it('radius sm/md/lg are unchanged', () => {
    expect(darkTheme.radius).toMatchObject({ sm: 8, md: 14, lg: 22 });
  });

  it('the dim overlay token is untouched (verbatim, not in the §9 delta-1 rewrite)', () => {
    expect(darkTheme.overlay).toEqual({ color: '#000000', maxDim: 0.72 });
  });
});

describe('AOD-66 additive tokens: no new hue, no change to any existing value', () => {
  it('onAccent is white on both themes (§4.4)', () => {
    expect(darkTheme.colors.onAccent).toBe('#FFFFFF');
    expect(lightTheme.colors.onAccent).toBe('#FFFFFF');
  });

  it('focusRing aliases accent in each theme (§4.4)', () => {
    expect(darkTheme.colors.focusRing).toBe(darkTheme.colors.accent);
    expect(lightTheme.colors.focusRing).toBe(lightTheme.colors.accent);
  });

  it('scrim is the black primitive at the fixed per-theme opacity (§4.4 / §8.3)', () => {
    expect(darkTheme.colors.scrim).toBe('rgba(0, 0, 0, 0.6)');
    expect(lightTheme.colors.scrim).toBe('rgba(0, 0, 0, 0.4)');
  });

  it('radius.full is added for pills / fully-rounded ends (§7.2)', () => {
    expect(darkTheme.radius.full).toBe(9999);
    expect(lightTheme.radius.full).toBe(9999);
  });

  it('the elevation ladder maps each level to a semantic surface role + border (§5.2)', () => {
    expect(darkTheme.elevation).toEqual({
      base: { surface: 'background', border: false },
      raised: { surface: 'surface', border: true },
      overlay: { surface: 'surfaceAlt', border: true },
    });
    // theme-independent: defined in role terms, identical in dark and light (§5.2)
    expect(lightTheme.elevation).toEqual(darkTheme.elevation);
    // every named surface resolves through a real semantic colour role (the layering rule, no raw hex)
    for (const level of Object.values(darkTheme.elevation)) {
      expect(darkTheme.colors).toHaveProperty(level.surface);
      expect(lightTheme.colors).toHaveProperty(level.surface);
    }
  });
});

describe('AOD-66 primitive tier: the single source of colour truth (§4.6 one accent, no new hue)', () => {
  it('every hue-bearing semantic role is sourced from a primitive ramp step', () => {
    const ramps = Object.values(primitive).flatMap((ramp) => Object.values(ramp));
    const hueRoles = [
      'background', 'surface', 'surfaceAlt', 'border', 'text', 'textMuted',
      'accent', 'skeleton', 'error', 'warning', 'success', 'onAccent', 'focusRing',
    ] as const;
    for (const theme of [darkTheme, lightTheme]) {
      for (const role of hueRoles) {
        expect(ramps).toContain(theme.colors[role]); // scrim is rgba (alpha), deliberately excluded
      }
    }
  });
});
