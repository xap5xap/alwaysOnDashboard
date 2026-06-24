// Babel for the Expo app. The Unistyles plugin (AOD-16/AOD-25 styling engine) rewrites
// StyleSheet.create call sites under `root` so the C++/Nitro core can track theme/runtime
// dependencies; it auto-disables when NODE_ENV === 'test' (Unistyles v3 jest guidance), where
// the `react-native-unistyles/mocks` setup file stands in instead (see jest.config.js).
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['react-native-unistyles/plugin', { root: 'src' }],
    ],
  };
};
