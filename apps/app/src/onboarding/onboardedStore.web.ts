// The first-run "onboarded" flag, web half (the verification target). MMKV has no web binding, so the
// equivalent fast synchronous store is window.localStorage (a noop-memory fallback guards any non-window
// render context). Metro resolves this .web.ts in place of onboardedStore.ts on web, so react-native-mmkv
// is never bundled here. Same shape as the native half (getOnboarded / setOnboarded / subscribeOnboarded).
const KEY = 'vela.onboarded';
const listeners = new Set<() => void>();
const storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
let memory = false;

export function getOnboarded(): boolean {
  if (storage) return storage.getItem(KEY) === 'true';
  return memory;
}

export function setOnboarded(value: boolean): void {
  if (storage) storage.setItem(KEY, value ? 'true' : 'false');
  else memory = value;
  listeners.forEach((listener) => listener());
}

export function subscribeOnboarded(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
