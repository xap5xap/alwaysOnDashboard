// AOD-69 token-lock (design-dashboard-editor.md §10). The same byte-identical guard AOD-66/67/68 used
// (__tests__/tokens.test.ts, component-tokens.test.ts, shell-tokens.test.ts): pin the one editor-scoped
// token group the dashboard editor adds (`arrange`) so a future edit cannot drift it silently. It is
// numbers + role-name aliases (a colour role), never a raw hex; the alias-validity block proves each alias
// names a REAL role, and the theme-independence block proves dark and light share the references.
import { darkTheme, lightTheme } from '../unistyles';

describe('§10 editor-scoped token group: pinned byte-identical (numbers + role-name aliases)', () => {
  it('arrange', () => {
    expect(darkTheme.arrange).toEqual({
      selectBorder: 'accent', // the bodyArranging border
      selectFill: 'surfaceAlt', // the bodyArranging fill
      handle: { dot: 24, hit: 44, ring: 'background' }, // the 24pt resize dot in a 44pt hit, ringed in background
      configurePill: { bg: 'accent', label: 'onAccent' }, // the top-left Configure pill
      // AOD-81 §5/§9: the wall boundary box, extending the group additively (numbers + role aliases, no hex).
      wallGuide: {
        stroke: 'border',
        strokeWidth: 2,
        dash: [6, 4],
        tagBg: 'surface',
        tagBorder: 'border',
        tagText: 'textMuted',
      },
    });
  });

  it('is theme-independent (dark and light share the same references)', () => {
    expect(lightTheme.arrange).toEqual(darkTheme.arrange);
  });
});

describe('§10 layering rule: every alias `arrange` names is a REAL role, never a raw hex', () => {
  it('every colour-role alias resolves to a real semantic role in both themes', () => {
    const g = darkTheme.arrange.wallGuide;
    const roles = [
      darkTheme.arrange.selectBorder,
      darkTheme.arrange.selectFill,
      darkTheme.arrange.handle.ring,
      darkTheme.arrange.configurePill.bg,
      darkTheme.arrange.configurePill.label,
      // AOD-81: the wallGuide colour aliases must name real roles too.
      g.stroke,
      g.tagBg,
      g.tagBorder,
      g.tagText,
    ];
    for (const role of roles) {
      expect(darkTheme.colors).toHaveProperty(role);
      expect(lightTheme.colors).toHaveProperty(role);
    }
  });

  it('the geometry values are numbers (dot/hit are pixel sizes, not roles)', () => {
    expect(typeof darkTheme.arrange.handle.dot).toBe('number');
    expect(typeof darkTheme.arrange.handle.hit).toBe('number');
    expect(darkTheme.arrange.handle.hit).toBeGreaterThan(darkTheme.arrange.handle.dot); // the hit target is larger than the dot
  });

  it('AOD-81 wallGuide: the geometry is plain numbers (strokeWidth + the dash pair), Unistyles-safe', () => {
    const g = darkTheme.arrange.wallGuide;
    expect(g.strokeWidth).toBe(2);
    expect(g.dash).toEqual([6, 4]); // an SVG strokeDasharray, not a role
    expect(g.dash.every((n) => typeof n === 'number')).toBe(true);
    expect(lightTheme.arrange.wallGuide).toEqual(g); // theme-independent
  });

  it('the canvas unit is NOT a token (UNIT_PX lives in geometry.ts, §10 row 2)', () => {
    expect(darkTheme.arrange).not.toHaveProperty('unit');
    expect((darkTheme as Record<string, unknown>).UNIT_PX).toBeUndefined();
  });
});
