// AOD-121 theme composition helper lock (src/theme/appearance.ts). `themeName` is PURE: assert all four
// (palette × scheme) → registered-theme-key mappings, and that every result is a real appThemes key.
// `selectTheme` is the thin imperative wrapper: assert it forwards themeName's result to
// UnistylesRuntime.setTheme (the entry point the post-launch Settings themes picker will call, §8).
import { UnistylesRuntime } from 'react-native-unistyles';
import { themeName, selectTheme } from '../appearance';
import { appThemes } from '../../../unistyles';

describe('themeName: the pure palette × scheme → theme-key mapping', () => {
  it('Signature maps to the base dark / light themes (the default palette)', () => {
    expect(themeName('signature', 'dark')).toBe('dark');
    expect(themeName('signature', 'light')).toBe('light');
  });

  it('Monochrome suffixes the scheme', () => {
    expect(themeName('monochrome', 'dark')).toBe('darkMonochrome');
    expect(themeName('monochrome', 'light')).toBe('lightMonochrome');
  });

  it('every (palette × scheme) result is a registered appThemes key', () => {
    const palettes = ['signature', 'monochrome'] as const;
    const schemes = ['dark', 'light'] as const;
    for (const palette of palettes) {
      for (const scheme of schemes) {
        expect(appThemes).toHaveProperty(themeName(palette, scheme));
      }
    }
  });
});

describe('selectTheme: the thin runtime wrapper (the post-launch picker calls this)', () => {
  it('forwards the composed theme name to UnistylesRuntime.setTheme', () => {
    const spy = jest.spyOn(UnistylesRuntime, 'setTheme').mockImplementation(() => {});
    try {
      selectTheme('monochrome', 'light');
      expect(spy).toHaveBeenLastCalledWith('lightMonochrome');

      selectTheme('signature', 'dark');
      expect(spy).toHaveBeenLastCalledWith('dark');

      selectTheme('monochrome', 'dark');
      expect(spy).toHaveBeenLastCalledWith('darkMonochrome');

      selectTheme('signature', 'light');
      expect(spy).toHaveBeenLastCalledWith('light');

      expect(spy).toHaveBeenCalledTimes(4);
    } finally {
      spy.mockRestore();
    }
  });
});
