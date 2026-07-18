// AOD-120 token-lock (design-color-law.md §4-6; the freeze: claude-design/Vela - Made Fast.pdf 1a). The
// same byte-identical guard AOD-66/67/68/69/72 used (tokens.test.ts, component-tokens.test.ts,
// shell-tokens.test.ts, arrange-tokens.test.ts, wall-tokens.test.ts): pin the four data-hue families —
// temp (8 thermometer stops), ink (5 event inks, rain + sun each with a dim variant), pane (12 condition
// × daylight swatches, each bg/line/ink), when (6 imminence stops cut from the thermometer) — so a
// future edit cannot drift a frozen hex silently. Every hex here is FROZEN: device-verified on the Fire
// HD 8 in a dark room and passed (AOD-119, GO 2026-07-18) — no re-tune. Any future change lands as a
// DELIBERATE re-freeze of these constants alongside unistyles.ts, never a silent drift. The expected
// values are hard-coded (never sourced from `primitive` — that would be circular), from the Made Fast 1a table.
import { darkTheme, lightTheme, night, primitive } from '../unistyles';

// The frozen thermometer (--temp-*), cold end to swelter (Made Fast 1a).
const TEMP = {
  ice: '#7FA3D9', // <= 6°
  cold: '#8CA9C7', // 10°
  cool: '#B3AFA0', // 13°
  mild: '#C8B183', // 15°
  warm: '#D4A868', // 17°
  balmy: '#DC9853', // 19°
  hot: '#E08348', // 22°
  swelter: '#D65A3C', // 30°+
} as const;

// The frozen event inks (--ink-*). bone is NOT here: it joins at the semantic tier as an alias of each
// theme's text step (the freeze's "--ink-bone #F4F4F8 (= --text)").
const INK = {
  rain: '#6FB8C9',
  rainDim: '#5FA8BA',
  sun: '#D9A458',
  sunDim: '#9E7E4A',
  moon: '#C6CBE8',
  storm: '#A895E8',
} as const;

// The frozen condition panes (--pane-*): 12 condition × daylight swatches. clearNight alone carries the
// 4th value — the gold the moon draws in ON the night pane.
const PANE = {
  clearFirst: { bg: '#221419', line: '#3C242C', ink: '#C29AA4' },
  clearDay: { bg: '#17273C', line: '#2A3E58', ink: '#94ACC2' },
  clearGolden: { bg: '#2C1E12', line: '#48331E', ink: '#C2A478' },
  clearNight: { bg: '#121527', line: '#262B4A', ink: '#C9BE9E', moon: '#E0C182' },
  partlyDay: { bg: '#192332', line: '#2C384C', ink: '#9AAABE' },
  partlyNight: { bg: '#141724', line: '#272C42', ink: '#B8B29C' },
  cloudy: { bg: '#1C2028', line: '#2E333E', ink: '#A8B2BF' },
  fog: { bg: '#201E26', line: '#343141', ink: '#ACA8B8' },
  drizzle: { bg: '#16272E', line: '#2A3F47', ink: '#8FB5BC' },
  rain: { bg: '#14262D', line: '#274046', ink: '#89B4BC' },
  storm: { bg: '#1A172E', line: '#2E294C', ink: '#A29CC6' },
  snow: { bg: '#1F2734', line: '#344052', ink: '#BCCBDA' },
} as const;

/** Every data-hue value a theme exposes, flattened: temp + ink + pane (bg/line/ink/moon) + when. */
function dataHues(theme: typeof darkTheme | typeof lightTheme): string[] {
  return [
    ...Object.values(theme.temp),
    ...Object.values(theme.ink),
    ...Object.values(theme.pane).flatMap((swatch) => Object.values(swatch)),
    ...Object.values(theme.when),
  ];
}

describe('1a the frozen primitive ramps: pinned byte-identical (FROZEN, device-verified AOD-119 GO)', () => {
  it('the thermometer (--temp-*): 8 stops, ice through swelter', () => {
    expect(primitive.temp).toEqual(TEMP);
  });

  it('the event inks (--ink-*): rain + sun with dim variants, moon, storm', () => {
    expect(primitive.ink).toEqual(INK);
  });

  it('the condition panes (--pane-*): 12 condition × daylight swatches, each bg/line/ink', () => {
    expect(primitive.pane).toEqual(PANE);
  });

  it('clearNight alone carries the 4th value: the gold the moon draws in on the night pane', () => {
    expect(primitive.pane.clearNight.moon).toBe('#E0C182');
    for (const [name, swatch] of Object.entries(primitive.pane)) {
      if (name === 'clearNight') continue;
      expect(Object.keys(swatch).sort()).toEqual(['bg', 'ink', 'line']); // no stray moon on a day pane
    }
  });
});

describe('the semantic families on the theme (the three-tier seam, design-color-law.md §8)', () => {
  it('darkTheme.temp / darkTheme.pane expose the frozen ramps verbatim', () => {
    expect(darkTheme.temp).toEqual(TEMP);
    expect(darkTheme.pane).toEqual(PANE);
  });

  it('darkTheme.ink adds bone as the text role (the freeze\'s "--ink-bone #F4F4F8 (= --text)")', () => {
    expect(darkTheme.ink).toEqual({ ...INK, bone: '#F4F4F8' });
    expect(darkTheme.ink.bone).toBe(darkTheme.colors.text);
  });

  it('the when scale: 6 imminence stops cut from the thermometer, re-keyed, no new hex', () => {
    expect(darkTheme.when).toEqual({
      distant: '#7FA3D9', // = temp.ice
      far: '#8CA9C7', // = temp.cold
      approaching: '#B3AFA0', // = temp.cool
      near: '#C8B183', // = temp.mild
      soon: '#D4A868', // = temp.warm
      now: '#DC9853', // = temp.balmy
    });
    // each stop IS a thermometer stop (the cut, ice→balmy in order)...
    const cut = ['ice', 'cold', 'cool', 'mild', 'warm', 'balmy'] as const;
    expect(Object.values(darkTheme.when)).toEqual(cut.map((stop) => primitive.temp[stop]));
    // ...and the ramp never reaches real heat: a meeting warms, but never reads hot (§6 vs Made Fast 1e)
    expect(Object.values(darkTheme.when)).not.toContain(primitive.temp.hot);
    expect(Object.values(darkTheme.when)).not.toContain(primitive.temp.swelter);
  });

  it('every semantic data hue is sourced from the primitive tier (the layering rule, no stray literal)', () => {
    const rampValues = Object.values(primitive).flatMap((ramp) =>
      Object.values(ramp).flatMap((step) => (typeof step === 'string' ? [step] : Object.values(step))),
    );
    for (const theme of [darkTheme, lightTheme]) {
      for (const hue of dataHues(theme)) expect(rampValues).toContain(hue);
    }
  });
});

describe('light theme: the untuned mirror of the dark/Signature freeze (dark FROZEN via AOD-119 GO)', () => {
  it('temp / pane / when mirror dark exactly (no light-tuned render exists yet)', () => {
    expect(lightTheme.temp).toEqual(darkTheme.temp);
    expect(lightTheme.pane).toEqual(darkTheme.pane);
    expect(lightTheme.when).toEqual(darkTheme.when);
  });

  it('ink differs ONLY in bone, which re-aliases to the light text step', () => {
    expect(lightTheme.ink).toEqual({ ...INK, bone: '#16161D' });
    expect(lightTheme.ink.bone).toBe(lightTheme.colors.text);
  });
});

describe('the discipline rules the byte-lock can enforce (Made Fast 1a freeze + colour-law §7)', () => {
  it('no data role resolves to the interaction accent in either theme (blue stays taps-only)', () => {
    for (const theme of [darkTheme, lightTheme]) {
      const hues = dataHues(theme);
      expect(hues).not.toContain('#6E8BFF'); // blue.400, the dark accent
      expect(hues).not.toContain('#3F5BD6'); // blue.600, the light accent
      expect(hues).not.toContain(theme.colors.accent);
    }
  });

  it('the interaction accent itself is untouched', () => {
    expect(darkTheme.colors.accent).toBe('#6E8BFF');
    expect(lightTheme.colors.accent).toBe('#3F5BD6');
  });

  it('no thermometer stop is the Clock\'s ember (night keeps the one saturated voice, §7)', () => {
    // The freeze ends the ramp at swelter #D65A3C, a pinned-lightness stop of its own — NOT ember.500
    // (#C2362B), which stays the ambient-night palette's alone. Guard against a well-meaning "fix".
    expect(Object.values(darkTheme.temp)).not.toContain(night.primary);
  });
});

describe('placement: machinery only, colors stays a flat role→string map', () => {
  it('the families do NOT leak into theme.colors (roleColor / the §12 alias machinery assume strings)', () => {
    for (const theme of [darkTheme, lightTheme]) {
      for (const key of ['temp', 'ink', 'pane', 'when']) {
        expect(theme.colors).not.toHaveProperty(key);
      }
      for (const value of Object.values(theme.colors)) expect(typeof value).toBe('string');
    }
  });
});
