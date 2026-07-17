// Jest manual mock for @react-native-community/netinfo (AOD-127). The real package is a native module with
// no JS binding under jest-expo and throws at import time, so — like react-native-mmkv / react-native-purchases
// in this folder — a node_modules manual mock is auto-applied to every test that pulls it (no jest.mock() call
// needed). An in-memory state + listener set matches the netinfo surface the connectivity plumbing uses
// (addEventListener / fetch / configure) and emits the current state to a new subscriber the way netinfo does.
//
// Tests drive connectivity with the __ helpers: __setState({ isConnected: false }) flips the device offline
// and notifies every listener (which is how onlineManager, fed by setupOnlineManager, learns the flip);
// __reset() clears listeners and returns to a clean online state for isolation between tests.
let listeners = new Set();

const ONLINE = { type: 'wifi', isConnected: true, isInternetReachable: true };
let state = { ...ONLINE };

function emit() {
  for (const listener of listeners) listener(state);
}

const NetInfo = {
  addEventListener: (listener) => {
    listeners.add(listener);
    listener(state); // netinfo emits the latest state to a new subscriber
    return () => {
      listeners.delete(listener);
    };
  },
  fetch: async () => state,
  refresh: async () => state,
  configure: () => {},
  // --- test helpers (not part of the real netinfo API) ---
  __setState: (next) => {
    state = { ...state, ...next };
    emit();
  },
  __reset: () => {
    listeners = new Set();
    state = { ...ONLINE };
  },
};

module.exports = { __esModule: true, default: NetInfo, ...NetInfo };
