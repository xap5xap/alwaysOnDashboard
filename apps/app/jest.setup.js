// Jest setup that runs before the test framework (testing-strategy §3.2). AOD-62 added the host
// RefreshControl (the AOD-15 in-flight refresh spin), which imports react-native-reanimated; that pulls
// reanimated 4 -> react-native-worklets, whose native part is not present under jest-expo and throws at
// import time. reanimated's own `/mock` re-imports the real index (so it hits the same worklets init),
// so we provide a focused manual mock instead: Animated.* render as plain RN components and the worklet
// helpers are synchronous no-ops, which is all the host chrome needs in component-band tests. Registered
// here (setupFiles has `jest` available, like the unistyles mock) so it is in place before any require.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, ScrollView, Image } = require('react-native');

  const passthrough = (value) => value; // withTiming/withRepeat/withDelay -> the target value, no animation
  const animate = (Component) => React.forwardRef((props, ref) => React.createElement(Component, { ...props, ref }));
  const Animated = {
    View: animate(View),
    Text: animate(Text),
    ScrollView: animate(ScrollView),
    Image: animate(Image),
    createAnimatedComponent: (Component) => animate(Component),
  };

  const easingFn = (t) => t;
  const Easing = new Proxy(
    { linear: easingFn, ease: easingFn, in: () => easingFn, out: () => easingFn, inOut: () => easingFn, bezier: () => easingFn },
    { get: (target, key) => (key in target ? target[key] : easingFn) },
  );

  return {
    __esModule: true,
    default: Animated,
    useSharedValue: (initial) => ({ value: initial }),
    // Run the worklet so a style consumer (the spin) still gets a concrete style object under test.
    useAnimatedStyle: (factory) => {
      try {
        return factory();
      } catch {
        return {};
      }
    },
    useDerivedValue: (factory) => ({ value: factory() }),
    useAnimatedReaction: () => {},
    withTiming: passthrough,
    withSpring: passthrough,
    withRepeat: passthrough,
    withDelay: (_delay, value) => value,
    withSequence: (...values) => values[values.length - 1],
    cancelAnimation: () => {},
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    interpolate: (value) => value,
    Easing,
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  };
});
