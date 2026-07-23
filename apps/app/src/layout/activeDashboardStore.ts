// The active-sky pointer store (AOD-143, Many Skies §1b: "the active sky"). The lightest persisted client
// KV for WHICH dashboard is active — deliberately NOT a DB table: the active sky is a per-device view
// preference, not shared layout state (§1b: hanging a sky on a wall is a separate, phone-set choice), so it
// rides the same on-device fast store the query cache uses, never a row that would sync across a user's
// devices. Native half: react-native-mmkv (synchronous, the exact KV queryPersister.ts uses) under a
// DISTINCT id so the two never collide. The web half (window.localStorage) lives in
// activeDashboardStore.web.ts; Metro platform resolution keeps MMKV out of the web bundle, the same split
// queryPersister.web.ts uses. Under jest (jest-expo defaultPlatform 'ios') this base file resolves and the
// jest-expo MMKV mock backs it in-memory. The value is a bare dashboard id string; absence (null) = unset,
// which the hook layer resolves to "the first sky by position".
import { createMMKV } from 'react-native-mmkv';

const ACTIVE_KEY = 'vela.activeDashboardId';

// A separate MMKV id from the 'vela-query-cache' persister store: this is a single scalar pointer, not the
// serialized query cache, so it lives in its own namespace and a cache clear never drops the active sky.
const store = createMMKV({ id: 'vela-active-sky' });

/** The persisted active-sky id, or null when none has been chosen yet (the hook defaults to the first sky). */
export function getActiveDashboardId(): string | null {
  return store.getString(ACTIVE_KEY) ?? null;
}

/** Persist the active-sky id (setActive / create-descends-into-new / delete-moves-to-neighbor all route here). */
export function setActiveDashboardId(id: string): void {
  store.set(ACTIVE_KEY, id);
}
