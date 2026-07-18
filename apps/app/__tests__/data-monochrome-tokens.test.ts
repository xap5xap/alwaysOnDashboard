// AOD-121 Monochrome token-lock (design-color-law.md §8: "every meaning-role collapses to the white /
// gray ramp. This is today's build."). The byte-identical guard the AOD-66/67/68/69/72/120 locks use
// (tokens.test.ts, component-tokens.test.ts, shell-tokens.test.ts, arrange-tokens.test.ts,
// wall-tokens.test.ts, data-tokens.test.ts), now for the Monochrome theme: pin every collapsed data value,
// prove Monochrome draws PURELY from the frozen neutral ramp (no Signature hue leaks in), and prove each
// Monochrome variant is byte-identical to its Signature sibling EXCEPT the four data families. Unlike the
// Signature families (PROVISIONAL pending AOD-119, the Fire HD 8 re-tune), these values are NOT
// provisional — they derive from the shipped-frozen neutral ramp. Expected hexes are hard-coded (never
// sourced from `primitive` — that would be circular), copied from the neutral ramp: they ARE each theme's
// text / textMuted / surface / border roles.
import { appThemes, darkTheme, lightTheme, darkMonochrome, lightMonochrome, primitive } from '../unistyles';

// The frozen neutral steps each scheme's Monochrome collapse draws from (= that theme's text / textMuted /
// surface / border, hard-coded to primitive.neutral values).
const DARK = { text: '#F4F4F8', textMuted: '#9B9BA8', surface: '#16161D', border: '#2A2A36' } as const;
const LIGHT = { text: '#16161D', textMuted: '#6B6B78', surface: '#FFFFFF', border: '#DADAE2' } as const;

// The expected collapsed families per scheme, spelling out the exact per-role → neutral mapping (§8).
function expectedFamilies(n: { text: string; textMuted: string; surface: string; border: string }) {
  const pane = { bg: n.surface, line: n.border, ink: n.text }; // the sky → the ordinary card surface
  return {
    // temp 8: every thermometer stop is bone (text) — no gradient survives the collapse
    temp: {
      ice: n.text, cold: n.text, cool: n.text, mild: n.text,
      warm: n.text, balmy: n.text, hot: n.text, swelter: n.text,
    },
    // ink 7: figures are bone; only the explicit *Dim variants recede to textMuted
    ink: {
      rain: n.text, rainDim: n.textMuted, sun: n.text, sunDim: n.textMuted,
      moon: n.text, storm: n.text, bone: n.text,
    },
    // pane 12 × {bg,line,ink} + clearNight.moon: identical card surface; the moon draws as bone
    pane: {
      clearFirst: { ...pane }, clearDay: { ...pane }, clearGolden: { ...pane },
      clearNight: { ...pane, moon: n.text },
      partlyDay: { ...pane }, partlyNight: { ...pane },
      cloudy: { ...pane }, fog: { ...pane }, drizzle: { ...pane },
      rain: { ...pane }, storm: { ...pane }, snow: { ...pane },
    },
    // when 6: every imminence stop is bone (text) — no time-to-event colour in monochrome
    when: {
      distant: n.text, far: n.text, approaching: n.text, near: n.text, soon: n.text, now: n.text,
    },
  };
}

/** Every data-hue value a theme exposes, flattened: temp + ink + pane (bg/line/ink/moon) + when. */
function dataHues(theme: typeof darkMonochrome | typeof lightMonochrome): string[] {
  return [
    ...Object.values(theme.temp),
    ...Object.values(theme.ink),
    ...Object.values(theme.pane).flatMap((swatch) => Object.values(swatch)),
    ...Object.values(theme.when),
  ];
}

describe('AOD-121 Monochrome: the four data families collapse to the neutral ramp (NOT provisional)', () => {
  it('darkMonochrome collapses temp / ink / pane / when to the dark neutral steps', () => {
    const expected = expectedFamilies(DARK);
    expect(darkMonochrome.temp).toEqual(expected.temp);
    expect(darkMonochrome.ink).toEqual(expected.ink);
    expect(darkMonochrome.pane).toEqual(expected.pane);
    expect(darkMonochrome.when).toEqual(expected.when);
  });

  it('lightMonochrome collapses temp / ink / pane / when to the light neutral steps', () => {
    const expected = expectedFamilies(LIGHT);
    expect(lightMonochrome.temp).toEqual(expected.temp);
    expect(lightMonochrome.ink).toEqual(expected.ink);
    expect(lightMonochrome.pane).toEqual(expected.pane);
    expect(lightMonochrome.when).toEqual(expected.when);
  });
});

describe('the exact per-role → neutral mapping (§8 "today\'s build")', () => {
  it('temp: every thermometer stop is bone (text), all 8 stops present', () => {
    expect(new Set(Object.values(darkMonochrome.temp))).toEqual(new Set([DARK.text]));
    expect(Object.keys(darkMonochrome.temp)).toHaveLength(8);
  });

  it('ink: figures are bone (text); the rainDim / sunDim variants recede to textMuted', () => {
    expect(darkMonochrome.ink).toEqual({
      rain: DARK.text, rainDim: DARK.textMuted,
      sun: DARK.text, sunDim: DARK.textMuted,
      moon: DARK.text, storm: DARK.text, bone: DARK.text,
    });
  });

  it('pane: every swatch is the ordinary card surface (bg→surface, line→border, ink→text)', () => {
    for (const swatch of Object.values(darkMonochrome.pane)) {
      expect(swatch.bg).toBe(DARK.surface);
      expect(swatch.line).toBe(DARK.border);
      expect(swatch.ink).toBe(DARK.text);
    }
  });

  it('clearNight alone keeps the 4th value: the moon, drawn as bone (text)', () => {
    expect(darkMonochrome.pane.clearNight.moon).toBe(DARK.text);
    for (const [name, swatch] of Object.entries(darkMonochrome.pane)) {
      if (name === 'clearNight') continue;
      expect(Object.keys(swatch).sort()).toEqual(['bg', 'ink', 'line']); // no stray moon on a day pane
    }
  });

  it('when: every imminence stop is bone (text), all 6 stops present', () => {
    expect(new Set(Object.values(darkMonochrome.when))).toEqual(new Set([DARK.text]));
    expect(Object.keys(darkMonochrome.when)).toHaveLength(6);
  });
});

describe('Monochrome draws ONLY from the neutral ramp — no Signature hue survives', () => {
  const neutralValues = Object.values(primitive.neutral);
  // Signature data hues, built from the primitive ramps ONLY (bone is excluded — it is a neutral role in
  // both themes, not a hue): so a monochrome value equal to `text` is not counted as a hue leak.
  const signatureHues = new Set<string>([
    ...Object.values(primitive.temp),
    ...Object.values(primitive.ink),
    ...Object.values(primitive.pane).flatMap((swatch) => Object.values(swatch)),
  ]);

  it('every Monochrome data value is a primitive.neutral step', () => {
    for (const theme of [darkMonochrome, lightMonochrome]) {
      for (const hue of dataHues(theme)) expect(neutralValues).toContain(hue);
    }
  });

  it('no Signature data hue (temp / ink / pane) leaks into Monochrome', () => {
    for (const theme of [darkMonochrome, lightMonochrome]) {
      for (const hue of dataHues(theme)) expect(signatureHues.has(hue)).toBe(false);
    }
  });

  it('no data role resolves to the interaction accent (blue stays taps-only, as in Signature)', () => {
    for (const theme of [darkMonochrome, lightMonochrome]) {
      const hues = dataHues(theme);
      expect(hues).not.toContain('#6E8BFF'); // blue.400, the dark accent
      expect(hues).not.toContain('#3F5BD6'); // blue.600, the light accent
    }
  });
});

describe('Monochrome = the Signature sibling VERBATIM except the four data families', () => {
  const DATA = new Set(['temp', 'ink', 'pane', 'when']);

  it('the registry exposes exactly the four palette × scheme keys', () => {
    expect(Object.keys(appThemes)).toEqual(['dark', 'light', 'darkMonochrome', 'lightMonochrome']);
    expect(appThemes.darkMonochrome).toBe(darkMonochrome);
    expect(appThemes.lightMonochrome).toBe(lightMonochrome);
  });

  it('darkMonochrome shares every non-data key with darkTheme by reference (spread carried it through)', () => {
    expect(Object.keys(darkMonochrome).sort()).toEqual(Object.keys(darkTheme).sort());
    for (const [key, value] of Object.entries(darkTheme)) {
      if (DATA.has(key)) continue;
      expect(darkMonochrome[key as keyof typeof darkMonochrome]).toBe(value);
    }
  });

  it('lightMonochrome shares every non-data key with lightTheme by reference', () => {
    expect(Object.keys(lightMonochrome).sort()).toEqual(Object.keys(lightTheme).sort());
    for (const [key, value] of Object.entries(lightTheme)) {
      if (DATA.has(key)) continue;
      expect(lightMonochrome[key as keyof typeof lightMonochrome]).toBe(value);
    }
  });

  it('colors + the ambient-night ember are byte-identical (the Signature colour locks cover Monochrome too)', () => {
    expect(darkMonochrome.colors).toEqual(darkTheme.colors);
    expect(lightMonochrome.colors).toEqual(lightTheme.colors);
    expect(darkMonochrome.night).toBe(darkTheme.night); // the Clock keeps the one saturated voice (§6)
  });
});
