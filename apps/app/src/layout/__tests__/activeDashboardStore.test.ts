// Locks the active-sky pointer store (AOD-143). The react-native-mmkv manual mock (apps/app/__mocks__) backs
// createMMKV in memory, so this exercises the REAL getString() ?? null coercion and the set path the whole
// active-sky resolution depends on (useDashboard.loadActiveDashboard) — a broken pointer KV would otherwise
// ship green (every hook test mocks this module).
import { getActiveDashboardId, setActiveDashboardId } from '../activeDashboardStore';

describe('activeDashboardStore: the active-sky pointer KV', () => {
  it('returns null when no sky has been chosen (fresh store)', () => {
    // Runs first: the in-memory mock store starts empty, so an unread key coerces undefined -> null.
    expect(getActiveDashboardId()).toBeNull();
  });

  it('round-trips a persisted active-sky id', () => {
    setActiveDashboardId('dash-42');
    expect(getActiveDashboardId()).toBe('dash-42');
  });

  it('overwrites the previous pointer (setActive / create-descend / delete-neighbor all route here)', () => {
    setActiveDashboardId('dash-1');
    setActiveDashboardId('dash-2');
    expect(getActiveDashboardId()).toBe('dash-2');
  });
});
