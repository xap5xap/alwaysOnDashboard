// AOD-211 token-lock (design-quick-actions-menu.md §10). The same byte-identical guard AOD-66/67/68/69 used
// (__tests__/tokens.test.ts, component-tokens.test.ts, shell-tokens.test.ts, arrange-tokens.test.ts): pin the
// one menu-scoped token group the quick-actions restyle adds (`quickMenu`) so a future edit cannot drift it
// silently. It is numbers + role-name aliases (colour roles / a radius key / a type step) plus two literal
// rgba strings the menu consumes directly (`dim`, the §9 recorded revision) — never a raw palette hex. The
// alias-validity block proves each alias names a REAL role/step/radius; the theme-independence block proves
// dark and light share the references (Unistyles-safe: no embedded TextStyle, §10 typing note).
import { darkTheme, lightTheme } from '../unistyles';

describe('§10 quick-actions-menu token group: pinned byte-identical (numbers + role-name aliases)', () => {
  it('quickMenu', () => {
    expect(darkTheme.quickMenu).toEqual({
      minWidth: 220,
      rowMinHeight: 48,
      rowPaddingX: 16, // spacing(4)
      icon: { size: 20, gap: 12, tone: 'textMuted' }, // gap = spacing(3)
      destructive: { tone: 'error' }, // red INK; the pressed fill stays the neutral step (no red fill)
      beak: { w: 16, h: 8, fill: 'surfaceAlt', edge: 'border' },
      dim: 'rgba(0, 0, 0, 0.40)', // the §9 local focus dim (a literal rgba, not a colors role)
      liftScale: 1.02,
      liftBorder: 'textMuted',
      footprint: {
        glyph: { S: { w: 14, h: 14 }, M: { w: 14, h: 22 }, W: { w: 24, h: 14 }, L: { w: 22, h: 22 } },
        corner: 3,
        stroke: 1.5,
        strokeRole: 'textMuted',
        selectedFill: 'accentMuted',
        selectedOutline: 'accent',
        selectedLetter: 'accent',
        letter: 'caption',
        cellTouch: 44,
        selectedRadius: 'sm',
      },
    });
  });

  it('is theme-independent (dark and light share the same references)', () => {
    expect(lightTheme.quickMenu).toEqual(darkTheme.quickMenu);
  });
});

describe('§10 layering rule: every alias quickMenu names is a REAL role/step/radius, never a raw hex', () => {
  const q = darkTheme.quickMenu;

  it('every colour-role alias resolves to a real semantic role in both themes', () => {
    const roles = [
      q.icon.tone,
      q.destructive.tone,
      q.beak.fill,
      q.beak.edge,
      q.liftBorder,
      q.footprint.strokeRole,
      q.footprint.selectedFill,
      q.footprint.selectedOutline,
      q.footprint.selectedLetter,
    ];
    for (const role of roles) {
      expect(darkTheme.colors).toHaveProperty(role);
      expect(lightTheme.colors).toHaveProperty(role);
    }
  });

  it('the footprint letter aliases a real type STEP (a NAME, not an embedded TextStyle)', () => {
    expect(typeof q.footprint.letter).toBe('string');
    expect(darkTheme.type).toHaveProperty(q.footprint.letter);
  });

  it('the selected-cell radius aliases a real radius key', () => {
    expect(darkTheme.radius).toHaveProperty(q.footprint.selectedRadius);
  });

  it('the geometry values are numbers (sizes, not roles); dim is a literal rgba, not a colors role', () => {
    expect(typeof q.minWidth).toBe('number');
    expect(typeof q.rowMinHeight).toBe('number');
    expect(typeof q.liftScale).toBe('number');
    expect(q.liftScale).toBeGreaterThan(1); // the lift grows the card slightly
    expect(q.dim.startsWith('rgba(')).toBe(true);
    expect(darkTheme.colors).not.toHaveProperty('dim'); // dim is consumed directly, not a role
  });

  it('every footprint glyph is a positive w×h box (proportioned to the real slots)', () => {
    for (const size of ['S', 'M', 'W', 'L'] as const) {
      const g = q.footprint.glyph[size];
      expect(g.w).toBeGreaterThan(0);
      expect(g.h).toBeGreaterThan(0);
    }
    // W is WIDE (w > h), M is TALL (h > w) — the shape carries the size (§6, W is a wide rounded-rect).
    expect(q.footprint.glyph.W.w).toBeGreaterThan(q.footprint.glyph.W.h);
    expect(q.footprint.glyph.M.h).toBeGreaterThan(q.footprint.glyph.M.w);
  });
});
