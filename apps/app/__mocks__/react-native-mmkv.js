// Jest manual mock for react-native-mmkv (a Nitro native module with no JS binding under jest). Auto-applied
// for any test that imports the module (jest uses a node_modules manual mock automatically). An in-memory
// createMMKV() keyed by id, matching the v4 surface the app uses (createMMKV / getBoolean / getString / set /
// remove). Keeps the AOD-29 onboardedStore + the AOD-25 queryPersister loadable in tests without the binary.
const stores = new Map();

function createMMKV(config = {}) {
  const id = config.id || 'default';
  if (!stores.has(id)) stores.set(id, new Map());
  const map = stores.get(id);
  return {
    getBoolean: (key) => (map.has(key) ? map.get(key) : undefined),
    getString: (key) => (map.has(key) ? map.get(key) : undefined),
    getNumber: (key) => (map.has(key) ? map.get(key) : undefined),
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
    delete: (key) => {
      map.delete(key);
    },
    clearAll: () => {
      map.clear();
    },
  };
}

module.exports = { createMMKV };
