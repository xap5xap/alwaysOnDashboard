// The TanStack Query cold-start persister, web half. On web (the verification target) the locked
// MMKV module has no native binding, so the equivalent fast synchronous store is window.localStorage,
// which is already Web-Storage shaped. Metro resolves this .web.ts in place of queryPersister.ts on
// web, so react-native-mmkv is never bundled here. A noop store guards any non-window render context.
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const memory = new Map<string, string>();
const noopStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
};

const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : noopStorage;

export const queryPersister = createSyncStoragePersister({
  storage,
  key: 'vela-query-cache',
});
