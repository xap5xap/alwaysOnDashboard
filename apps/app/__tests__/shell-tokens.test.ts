// AOD-68 token-lock (design-core-navigation.md §11). The same byte-identical guard AOD-66/AOD-67 used
// (__tests__/tokens.test.ts, component-tokens.test.ts): pin the two screen-scoped token groups the nav
// shell adds (appBar / screen) so a future edit cannot drift them silently. They are numbers + role-name
// aliases (a colour role / a type step), never a raw hex; the alias-validity block proves each alias
// names a REAL role/step, and the theme-independence block proves dark and light share the references.
import { darkTheme, lightTheme } from '../unistyles';

describe('§11 screen-scoped token groups: pinned byte-identical (numbers + role-name aliases)', () => {
  it('appBar', () => {
    expect(darkTheme.appBar).toEqual({
      height: 56, // spacing(14)
      paddingX: 16, // spacing(4)
      title: 'title', // aliases type.title
      background: 'background',
      border: 'border',
    });
  });

  it('screen', () => {
    expect(darkTheme.screen).toEqual({ paddingX: 20, gap: 16 });
  });

  it('the groups are theme-independent (dark and light share the same references)', () => {
    expect(lightTheme.appBar).toEqual(darkTheme.appBar);
    expect(lightTheme.screen).toEqual(darkTheme.screen);
  });
});

describe('§11 layering rule: every alias a group names is a REAL role/step, never a raw hex', () => {
  it('appBar colour-role aliases resolve to real semantic roles in both themes', () => {
    for (const role of [darkTheme.appBar.background, darkTheme.appBar.border]) {
      expect(darkTheme.colors).toHaveProperty(role);
      expect(lightTheme.colors).toHaveProperty(role);
    }
  });

  it('appBar.title aliases a real type step (a NAME, not an embedded TextStyle)', () => {
    expect(typeof darkTheme.appBar.title).toBe('string');
    expect(darkTheme.type).toHaveProperty(darkTheme.appBar.title);
  });
});
