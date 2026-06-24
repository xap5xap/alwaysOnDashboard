// jest (jest-expo) for the app + the shared module under Metro semantics (testing-strategy.md
// §3.2, §4.1, §9). Unistyles v3 testing guidance: load `react-native-unistyles/mocks` BEFORE the
// theme config, and the babel plugin auto-disables under NODE_ENV=test. @vela/shared is mapped to
// its real TS source (not the node_modules symlink) so babel-jest transforms it and the reach-up
// into supabase/functions/_shared resolves, proving the Metro half of the cross-runtime contract.
const path = require('path');

module.exports = {
  preset: 'jest-expo',
  setupFiles: [
    'react-native-unistyles/mocks',
    '<rootDir>/unistyles.ts',
  ],
  moduleNameMapper: {
    '^@vela/shared$': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    '^@vela/shared/(.*)$': path.resolve(__dirname, '../../packages/shared/src/$1'),
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
};
