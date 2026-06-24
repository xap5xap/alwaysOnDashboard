// Unistyles v3 configuration (AOD-16 styling foundation, package locked in AOD-25). One typed token
// theme the host chrome and the stub card style against. This is the walking-skeleton minimum: a
// dark ambient theme plus a light variant; the full design-token set (AOD-19) and the component
// library (AOD-20) land in DS-M1, and the Fire HD 8 spike (AOD-25) remains the gate before mass
// component build. Imported once at app entry (app/_layout.tsx) before any StyleSheet.create runs,
// and again from jest setupFiles so themes exist under test.
import { StyleSheet } from 'react-native-unistyles';

const sharedTokens = {
  spacing: (v: number) => v * 4,
  radius: { sm: 8, md: 14, lg: 22 },
} as const;

const darkTheme = {
  ...sharedTokens,
  colors: {
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
  },
} as const;

const lightTheme = {
  ...sharedTokens,
  colors: {
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
  },
} as const;

const appThemes = { dark: darkTheme, light: lightTheme };
const breakpoints = { xs: 0, sm: 360, md: 600, lg: 900, xl: 1200 } as const;

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: { initialTheme: 'dark' },
});
