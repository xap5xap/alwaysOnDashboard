// The active-sky pointer store, web half (AOD-143). On web the MMKV native module has no binding, so the
// equivalent fast synchronous store is window.localStorage (already Web-Storage shaped) — the same swap
// queryPersister.web.ts makes. A noop in-memory store guards a non-window render context (SSR / a bare test
// env), so a get/set never throws. Metro resolves this .web.ts on web, so react-native-mmkv is never bundled
// here. Same public surface as activeDashboardStore.ts.
const ACTIVE_KEY = 'vela.activeDashboardId';

const memory = new Map<string, string>();
const storage =
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => void memory.set(key, value),
      };

/** The persisted active-sky id, or null when none has been chosen yet (the hook defaults to the first sky). */
export function getActiveDashboardId(): string | null {
  return storage.getItem(ACTIVE_KEY);
}

/** Persist the active-sky id (setActive / create-descends-into-new / delete-moves-to-neighbor all route here). */
export function setActiveDashboardId(id: string): void {
  storage.setItem(ACTIVE_KEY, id);
}
