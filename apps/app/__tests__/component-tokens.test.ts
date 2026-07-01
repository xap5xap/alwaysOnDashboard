// AOD-67 token-lock (design-component-library.md §12). The same byte-identical guard AOD-66 used
// (__tests__/tokens.test.ts): pin every AOD-20 token addition so a future edit cannot drift it silently.
// Covers the promoted `accentMuted` semantic role (one accent at a low fixed alpha, no new hue), the
// `type.lineHeight` additions (§3.4), and every §12 component group (numbers + role-name aliases, never a
// raw hex). The alias-validity block proves each colour role a group names is a REAL semantic role.
import { darkTheme, lightTheme } from '../unistyles';

/** Parse a "#RRGGBB" hex into its [r, g, b] decimal channels. */
function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

describe('§3.3 accentMuted: the one accent at a low fixed alpha, no new hue', () => {
  it('resolves to the pinned rgba in each theme', () => {
    expect(darkTheme.colors.accentMuted).toBe('rgba(110, 139, 255, 0.14)');
    expect(lightTheme.colors.accentMuted).toBe('rgba(63, 91, 214, 0.12)');
  });

  it('shares the accent hue exactly (the rgb channels equal colors.accent; only alpha differs)', () => {
    for (const theme of [darkTheme, lightTheme]) {
      const [r, g, b] = rgb(theme.colors.accent);
      expect(theme.colors.accentMuted.startsWith(`rgba(${r}, ${g}, ${b}, `)).toBe(true);
    }
  });

  it('is a distinct token from the widget DATA alphas (progress 0.18, sparkline 0.5)', () => {
    // accentMuted is a chrome tint, not a data intensity; the per-widget alphas stay per-widget.
    expect(darkTheme.progress.trackOpacity).toBe(0.18);
    expect(darkTheme.sparkline.pastOpacity).toBe(0.5);
  });
});

describe('§3.4 type.lineHeight: added only to the multi-line app-copy steps', () => {
  it('body / meta / caption carry the new lineHeight, sizes unchanged', () => {
    expect(darkTheme.type.body).toEqual({ fontSize: 14, fontWeight: '500', lineHeight: 20 });
    expect(darkTheme.type.meta).toEqual({ fontSize: 13, fontWeight: '400', lineHeight: 18 });
    expect(darkTheme.type.caption).toEqual({ fontSize: 11, fontWeight: '500', letterSpacing: 1, lineHeight: 16 });
  });

  it('the numeric / single-line steps get NO lineHeight (still inside the narrow Pick)', () => {
    for (const step of ['display', 'hero', 'xl', 'title', 'heading', 'label', 'badge'] as const) {
      expect(darkTheme.type[step].lineHeight).toBeUndefined();
    }
  });
});

describe('§12 component token groups: pinned byte-identical (numbers + role-name aliases)', () => {
  it('button', () => {
    expect(darkTheme.button).toEqual({
      radius: 'md',
      gap: 8,
      disabledOpacity: 0.38,
      pressedTint: 'accentMuted',
      size: {
        sm: { height: 32, paddingX: 12, type: 'label' },
        md: { height: 40, paddingX: 16, type: 'body' },
        lg: { height: 48, paddingX: 20, type: 'heading' },
      },
      variant: {
        primary: { bg: 'accent', fg: 'onAccent', border: false },
        secondary: { bg: null, fg: 'accent', border: true },
        ghost: { bg: null, fg: 'accent', border: false },
        destructive: { bg: 'error', fg: 'onAccent', border: false },
      },
    });
  });

  it('input (border stays component-scoped: no semantic border fork)', () => {
    expect(darkTheme.input).toEqual({
      height: 44,
      paddingX: 12,
      radius: 'sm',
      fill: 'surfaceAlt',
      fillDisabled: 'surface',
      border: 'border',
      borderFocus: 'focusRing',
      borderError: 'error',
      placeholder: 'textMuted',
      borderWidth: 1,
      borderWidthFocus: 1.5,
      disabledOpacity: 0.4,
    });
  });

  it('toggle', () => {
    expect(darkTheme.toggle).toEqual({
      trackWidth: 52,
      trackHeight: 30,
      knobRadius: 11,
      padding: 2,
      radius: 'full',
      border: 'border',
      disabledOpacity: 0.4,
      on: { track: 'accent', knob: 'onAccent' },
      off: { track: 'surfaceAlt', knob: 'textMuted' },
    });
  });

  it('segmented (exclusive: full accent) + pill (multi-select: accentMuted)', () => {
    expect(darkTheme.segmented).toEqual({
      height: 36,
      radius: 'sm',
      paddingX: 12,
      group: 'surfaceAlt',
      border: 'border',
      fg: 'text',
      selectedBg: 'accent',
      selectedFg: 'onAccent',
    });
    expect(darkTheme.pill).toEqual({
      radius: 'full',
      paddingX: 12,
      paddingY: 8,
      fg: 'text',
      border: 'border',
      selectedBg: 'accentMuted',
      selectedBorder: 'accent',
      selectedFg: 'accent',
    });
  });

  it('surfaces: card / rowGroup / listRow / authCard', () => {
    expect(darkTheme.card).toEqual({ radius: 'md', padding: 12 });
    expect(darkTheme.rowGroup).toEqual({ radius: 'md', divider: 'border' });
    expect(darkTheme.listRow).toEqual({ padding: 12, gap: 12 });
    expect(darkTheme.authCard).toEqual({ radius: 'lg', padding: 24 });
  });

  it('overlays: sheet / modal / popover', () => {
    expect(darkTheme.sheet).toEqual({ radius: 'lg', paddingX: 20, paddingTop: 16, grabberWidth: 36, grabberHeight: 4 });
    expect(darkTheme.modal).toEqual({ radius: 'lg', padding: 20 });
    expect(darkTheme.popover).toEqual({ radius: 'md' });
  });

  it('skeleton + badge', () => {
    expect(darkTheme.skeleton).toEqual({ color: 'skeleton', barRadius: 'sm', shimmerOpacity: 0.5 });
    expect(darkTheme.badge).toEqual({
      radius: 'full',
      paddingX: 8,
      paddingY: 2,
      status: { warning: 'warning', error: 'error', success: 'success' },
      accent: { bg: 'accentMuted', fg: 'accent' },
      count: { primary: { bg: 'accent', fg: 'onAccent' }, neutral: { bg: 'surfaceAlt', fg: 'text', border: 'border' } },
    });
  });

  it('lockRow', () => {
    expect(darkTheme.lockRow).toEqual({ padding: 12, gap: 12, title: 'textMuted', glyph: 'textMuted', dimOpacity: 0.6 });
  });

  it('the groups are theme-independent (dark and light share the same shared-token references)', () => {
    for (const key of ['button', 'input', 'toggle', 'segmented', 'pill', 'card', 'rowGroup', 'listRow', 'authCard', 'sheet', 'modal', 'popover', 'skeleton', 'badge', 'lockRow'] as const) {
      expect(lightTheme[key]).toEqual(darkTheme[key]);
    }
  });
});

describe('§4 layering rule: every alias a group names is a REAL role, never a raw hex', () => {
  it('every colour-role alias resolves to a key of theme.colors', () => {
    const colorRoles = [
      'accent', 'onAccent', 'error', 'surfaceAlt', 'surface', 'border', 'focusRing',
      'textMuted', 'text', 'accentMuted', 'warning', 'success', 'skeleton',
    ];
    for (const role of colorRoles) {
      expect(darkTheme.colors).toHaveProperty(role);
      expect(lightTheme.colors).toHaveProperty(role);
    }
  });

  it('every radius alias a group names is a real radius key', () => {
    for (const key of ['sm', 'md', 'lg', 'full']) expect(darkTheme.radius).toHaveProperty(key);
  });

  it('every type-step alias a button size names is a real type step', () => {
    for (const step of [darkTheme.button.size.sm.type, darkTheme.button.size.md.type, darkTheme.button.size.lg.type]) {
      expect(darkTheme.type).toHaveProperty(step);
    }
  });
});
