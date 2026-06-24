// The TanStack Query cold-start persister, native half (AOD-25: react-native-mmkv + a Query
// persister for "instant cold-start paint of last-known data"). MMKV is synchronous, so it backs a
// sync-storage persister directly. The web half lives in queryPersister.web.ts (localStorage); Metro
// platform resolution keeps MMKV out of the web bundle entirely, so the native module is never
// resolved on web. On-device MMKV/New-Arch validation rides on the AOD-48 Fire HD 8 spike.
import { createMMKV } from 'react-native-mmkv';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// MMKV v4 is Nitro-based: a createMMKV() factory rather than `new MMKV()`, and remove() not delete().
const mmkv = createMMKV({ id: 'vela-query-cache' });

const syncStorage = {
  getItem: (key: string) => {
    const value = mmkv.getString(key);
    return value === undefined ? null : value;
  },
  setItem: (key: string, value: string) => {
    mmkv.set(key, value);
  },
  removeItem: (key: string) => {
    mmkv.remove(key);
  },
};

export const queryPersister = createSyncStoragePersister({
  storage: syncStorage,
  key: 'vela-query-cache',
});
