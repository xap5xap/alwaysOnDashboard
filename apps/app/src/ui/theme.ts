// Shared helpers for the AOD-20 component library (design-component-library.md §4). The components carry
// ROLE-NAME aliases from the §12 token groups (e.g. button.variant.primary.bg = 'accent') and resolve
// them to the live theme colour at the call site, so a theme swap re-aliases underneath and no component
// ever writes a raw hex. This is the one place the resolve happens, mirroring how the widget renderers
// read theme.colors[role] at their draw sites.
import { useUnistyles } from 'react-native-unistyles';

/** The live theme shape (Unistyles augments this via the module declaration in unistyles.ts). */
export type Theme = ReturnType<typeof useUnistyles>['theme'];

/** Resolve a semantic colour role name (or null/undefined for "no fill") to its theme hex/rgba. */
export function roleColor(theme: Theme, role: string | null | undefined): string | undefined {
  if (!role) return undefined;
  return (theme.colors as Record<string, string>)[role];
}

/** Resolve a radius role key ('sm' | 'md' | 'lg' | 'full') to its pixel value. */
export function roleRadius(theme: Theme, key: string): number {
  return (theme.radius as Record<string, number>)[key];
}

/** Resolve an elevation level (§4 ladder) to a fill + hairline. `base`/`raised`/`overlay` map to a
 *  semantic surface role + whether the 1px `border` hairline is drawn (design-tokens.md §5.2). No shadow:
 *  a drop shadow reads as glare on an emissive panel, so elevation is a surface-step, never a shadow. */
export function elevationStyle(theme: Theme, level: 'base' | 'raised' | 'overlay') {
  const l = theme.elevation[level];
  return {
    backgroundColor: roleColor(theme, l.surface),
    borderWidth: l.border ? 1 : 0,
    borderColor: l.border ? theme.colors.border : undefined,
  };
}
