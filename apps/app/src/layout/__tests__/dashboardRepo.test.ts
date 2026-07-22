// The first-run bootstrap seed at the DB boundary (AOD-126, resolves AOD-94): a fresh signup used to
// seed the walking-skeleton stub; it now seeds the Clock, the sole authClass 'none' widget, because a
// new user has no connections and the seed must render without one. Locks the exact inserted rows
// (dashboard + instance) and the seed's coherence with the REAL registry: a supported size whose rect
// matches the size's nominal geometry, avoiding the known-broken 1x1 `S` (hosted-dogfood finding),
// and a config that is born valid. Only the supabase client is mocked; mapper validation runs real.
//
// AOD-122 (deliberate lock update): the seed is now expressed as `W` (2x1) in the S/M/W/L slot
// vocabulary. The INSERTED row still locks size 'medium' — the widget_instances CHECK is frozen on
// the legacy five words, so the mapper serializes W to its exact geometric twin on write — while the
// MAPPED result locks 'W', the read-time coercion's output. Same DB bytes as pre-AOD-122; only the
// app-side vocabulary changed.
import {
  addWidgetInstance,
  bootstrapDashboard,
  createDashboard,
  deleteDashboard,
  deleteWidgetInstance,
  loadDashboardById,
  loadDashboards,
  moveInstanceToDashboard,
  persistInstanceLayout,
  renameDashboard,
  reorderDashboards,
} from '../dashboardRepo';
import { getWidgetDef } from '../../registry/registry';
import { SIZE_CATALOGUE } from '../../widgets/sizes';
import { validateConfig } from '../../widgets/config';
import { rowToInstance } from '../mapper';
import type { Tables } from '@vela/shared';

jest.mock('../../supabase/client', () => ({ supabase: { from: jest.fn() } }));
import { supabase } from '../../supabase/client';

// Captures the insert payload per table and answers the .insert().select().single() chain the repo
// drives: dashboards echoes an id + name; widget_instances echoes the row back like the DB would.
const inserts: Record<string, Record<string, unknown>> = {};

function tableChain(table: string) {
  return {
    insert: jest.fn((payload: Record<string, unknown>) => {
      inserts[table] = payload;
      return {
        select: jest.fn(() => ({
          single: jest.fn(async () =>
            table === 'dashboards'
              ? { data: { id: 'dash-1', name: payload.name }, error: null }
              : { data: { id: 'wi-1', created_at: '2026-07-17T00:00:00Z', ...payload }, error: null },
          ),
        })),
      };
    }),
  };
}

beforeEach(() => {
  for (const key of Object.keys(inserts)) delete inserts[key];
  (supabase.from as jest.Mock).mockReset().mockImplementation((table: string) => tableChain(table));
});

describe('bootstrapDashboard first-run seed (AOD-126: Clock, not the removed stub)', () => {
  it('creates the Wall dashboard and seeds exactly one Clock instance (W 2x1 at the origin, stored as the frozen-vocabulary "medium", empty config)', async () => {
    const result = await bootstrapDashboard('u1');

    expect(inserts.dashboards).toEqual({ user_id: 'u1', name: 'Wall', position: 0 });
    expect(inserts.widget_instances).toEqual({
      dashboard_id: 'dash-1',
      user_id: 'u1',
      service_id: 'clock',
      widget_type: 'clock',
      // The DB word: the column CHECK still allows only the legacy five (AOD-122 ships no migration),
      // so the W seed is stored as its geometric twin 'medium' — byte-identical to the pre-slot row.
      size: 'medium',
      config: {},
      // AOD-197: the rect jsonb now carries the shared footprint + a position per designed orientation.
      // A fresh board seeds LANDSCAPE only (the wall's orientation); portrait derives until arranged.
      rect: { w: 2, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 } } },
      refresh: null,
    });

    // The mapped result the dashboard paints: the read-time coercion re-derives W from the 2x1 rect.
    expect(result).toEqual({
      dashboardId: 'dash-1',
      name: 'Wall',
      instances: [
        {
          instanceId: 'wi-1',
          serviceId: 'clock',
          widgetType: 'clock',
          config: {},
          size: 'W',
          rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
        },
      ],
    });
  });

  it('the seed coheres with the real registry: a supported non-S Clock slot, nominal rect, valid config', async () => {
    await bootstrapDashboard('u1');
    // The coherence check runs on the APP-side instance (the real mapper maps the echoed row), because
    // supportedSizes speaks the S/M/W/L vocabulary while the raw row speaks the frozen DB words.
    const instance = rowToInstance(inserts.widget_instances as unknown as Tables<'widget_instances'>)!;
    expect(instance).toBeTruthy();

    // The seed resolves against the REAL registry (AOD-8 §9 invariant 1: no orphan instance on signup).
    const def = getWidgetDef(instance.serviceId, instance.widgetType);
    expect(def).toBeDefined();
    expect(def!.supportedSizes).toContain(instance.size);

    // The rect is the seeded slot's nominal geometry (SIZE_CATALOGUE), so size and rect agree.
    const spec = SIZE_CATALOGUE[instance.size];
    expect({ w: instance.rect.w, h: instance.rect.h }).toEqual({ w: spec.nominalW, h: spec.nominalH });

    // Known dogfood finding (NOT fixed here): Clock overflows a 1x1 cell, so the seed must avoid `S`.
    expect(instance.size).not.toBe('S');

    // Born valid: every Clock field is optional/defaulted, so {} passes and the host never opens on
    // needs_config for a brand-new user.
    expect(validateConfig(def!.configSchema, instance.config).ok).toBe(true);
  });
});

// AOD-197: addWidgetInstance now READS the board first (to place the card in every OTHER designed
// orientation at its firstFreeSlot — design §6.1) then INSERTs with a per-orientation position. These lock
// the two-step shape and the stored rect it writes. The mock answers BOTH the read (select->eq) and the
// insert (insert->select->single) on widget_instances from one object.
describe('addWidgetInstance: per-orientation insert (AOD-197)', () => {
  const seed = {
    serviceId: 'clock',
    widgetType: 'clock',
    config: {},
    size: 'W' as const,
    rect: { x: 2, y: 0, w: 2, h: 1, z: 1 },
  };

  function mockAdd(existingRows: unknown[]) {
    const selectEq = jest.fn(async () => ({ data: existingRows, error: null }));
    const captured: { payload?: Record<string, unknown> } = {};
    const single = jest.fn(async () => ({
      data: { id: 'wi-new', created_at: '2026-07-22T00:00:00Z', ...(captured.payload ?? {}) },
      error: null,
    }));
    const insert = jest.fn((payload: Record<string, unknown>) => {
      captured.payload = payload;
      return { select: jest.fn(() => ({ single })) };
    });
    (supabase.from as jest.Mock)
      .mockReset()
      .mockReturnValue({ select: jest.fn(() => ({ eq: selectEq })), insert });
    return { captured, selectEq };
  }

  it('a landscape-only board stores JUST pos.landscape = the seed, and returns the resolved instance', async () => {
    const { captured, selectEq } = mockAdd([]); // empty board
    const result = await addWidgetInstance('dash-1', 'u1', seed);

    // It read the board by dashboard_id before inserting.
    expect(selectEq).toHaveBeenCalledWith('dashboard_id', 'dash-1');
    // The written rect: shared footprint + landscape position only (portrait derives until arranged).
    expect(captured.payload).toMatchObject({
      dashboard_id: 'dash-1',
      user_id: 'u1',
      size: 'medium', // W's frozen-vocabulary twin
      rect: { w: 2, h: 1, z: 1, pos: { landscape: { x: 2, y: 0 } } },
    });
    // The returned instance is resolved for landscape (the flat render rect).
    expect(result).toMatchObject({ instanceId: 'wi-new', rect: { x: 2, y: 0, w: 2, h: 1, z: 1 }, size: 'W' });
  });

  it('when portrait is ALSO designed, the new card gets a firstFreeSlot in portrait too (add-in-all-designed)', async () => {
    // One existing card designed in BOTH orientations (a 2x1 at each origin).
    const existing = {
      id: 'wi-0',
      dashboard_id: 'dash-1',
      service_id: 'clock',
      widget_type: 'clock',
      size: 'medium',
      config: {},
      rect: { w: 2, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 }, portrait: { x: 0, y: 0 } } },
      refresh: null,
      created_at: '2026-07-17T00:00:00Z',
    };
    const { captured } = mockAdd([existing]);
    await addWidgetInstance('dash-1', 'u1', seed);

    // landscape = the seed's position; portrait = firstFreeSlot beside the existing card in the 4-col grid.
    expect((captured.payload as { rect: unknown }).rect).toEqual({
      w: 2,
      h: 1,
      z: 1,
      pos: { landscape: { x: 2, y: 0 }, portrait: { x: 2, y: 0 } },
    });
  });

  it('throws when the insert is rejected by RLS', async () => {
    const selectEq = jest.fn(async () => ({ data: [], error: null }));
    const single = jest.fn(async () => ({ data: null, error: new Error('rls denied') }));
    (supabase.from as jest.Mock).mockReset().mockReturnValue({
      select: jest.fn(() => ({ eq: selectEq })),
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single })) })),
    });
    await expect(addWidgetInstance('dash-1', 'u1', seed)).rejects.toThrow('rls denied');
  });
});

// AOD-197 (the data-layer keystone): persistInstanceLayout is a per-orientation read-modify-write.
// - DESIGNED orientation MOVE (the common path): ONE cheap UPDATE that sets pos[orientation] + the footprint
//   and PRESERVES the other orientation, with NO board load.
// - DESIGNED orientation RESIZE (footprint change) with the OTHER orientation designed: loads the board and
//   RE-VALIDATES the other orientation's stored position (nearestFreeSlot), so the grown footprint never
//   overlaps a neighbour there (design §6.2). The edited instance is still the only row written.
// - DERIVED orientation (portrait): MATERIALIZE — stamp every instance's reflowed portrait position (rect-only,
//   size untouched), then write the edited instance; a materialize that ALSO resizes re-validates the already-
//   designed landscape position against the same board.
describe('persistInstanceLayout: per-orientation read-modify-write (AOD-197)', () => {
  type Row = Partial<Tables<'widget_instances'>>;
  // A select/update mock answering the row-select (select->eq->maybeSingle), the board-load
  // (select->eq->order), and the UPDATEs (update->eq).
  function mockPersist(editedRect: unknown, boardRows: Row[] = [], dashboardId = 'd1') {
    const maybeSingle = jest.fn(async () => ({
      data: { rect: editedRect, dashboard_id: dashboardId },
      error: null,
    }));
    const order = jest.fn(async () => ({ data: boardRows, error: null }));
    const selectEqCalls: Array<[string, string]> = [];
    const selectEq = jest.fn((col: string, val: string) => {
      selectEqCalls.push([col, val]);
      return { maybeSingle, order };
    });
    const updates: Record<string, unknown>[] = [];
    const updateEqCalls: Array<[string, string]> = [];
    const updateEq = jest.fn(async (col: string, val: string) => {
      updateEqCalls.push([col, val]);
      return { error: null };
    });
    const update = jest.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
      return { eq: updateEq };
    });
    (supabase.from as jest.Mock)
      .mockReset()
      .mockReturnValue({ select: jest.fn(() => ({ eq: selectEq })), update });
    return { updates, updateEqCalls, selectEqCalls, order };
  }

  it('DESIGNED landscape MOVE (no footprint change): ONE cheap UPDATE, NO board load, PRESERVES portrait', async () => {
    // Already designed in both orientations; a plain MOVE keeps the 2x1 footprint, so nothing re-validates.
    const stored = { w: 2, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 }, portrait: { x: 3, y: 2 } } };
    const { updates, updateEqCalls, order } = mockPersist(stored);

    await persistInstanceLayout('wi-1', { rect: { x: 4, y: 1, w: 2, h: 1, z: 0 }, size: 'W' }); // move, landscape

    expect(order).not.toHaveBeenCalled(); // a plain move never loads the board (design §6.2 gate)
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({
      rect: { w: 2, h: 1, z: 0, pos: { landscape: { x: 4, y: 1 }, portrait: { x: 3, y: 2 } } },
      size: 'medium', // W's frozen-vocabulary twin
    });
    expect(updateEqCalls).toEqual([['id', 'wi-1']]);
  });

  it('DESIGNED landscape RESIZE with portrait ALSO designed: loads the board and re-validates portrait (design §6.2)', async () => {
    // wi-1 is a 1x1 designed in BOTH orientations; a neighbour wi-2 sits at portrait (1,0). Growing wi-1 to a
    // 2x2 would make its portrait origin (0,0) overlap wi-2, so the write re-validates wi-1's portrait position
    // to the nearest free 2x2 slot WITHOUT moving wi-2 (gaps preserved).
    const editedStored = { w: 1, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 }, portrait: { x: 0, y: 0 } } };
    const boardRows: Row[] = [
      { id: 'wi-1', service_id: 'clock', widget_type: 'clock', size: 'small', config: {}, rect: editedStored as never, refresh: null },
      {
        id: 'wi-2',
        service_id: 'clock',
        widget_type: 'clock',
        size: 'small',
        config: {},
        rect: { w: 1, h: 1, z: 0, pos: { landscape: { x: 2, y: 0 }, portrait: { x: 1, y: 0 } } } as never,
        refresh: null,
      },
    ];
    const { updates, updateEqCalls, order } = mockPersist(editedStored, boardRows);

    await persistInstanceLayout('wi-1', { rect: { x: 2, y: 0, w: 2, h: 2, z: 0 }, size: 'L' }); // resize, landscape

    expect(order).toHaveBeenCalled(); // a footprint change loads the board to re-validate the other orientation
    expect(updates).toHaveLength(1); // STILL one update — only the edited instance; the neighbour never moves
    expect(updateEqCalls).toEqual([['id', 'wi-1']]);
    // landscape = the new edit; portrait re-validated to the nearest free 2x2 (0,1), clear of wi-2 at (1,0).
    expect(updates[0]).toEqual({
      rect: { w: 2, h: 2, z: 0, pos: { landscape: { x: 2, y: 0 }, portrait: { x: 0, y: 1 } } },
      size: 'large',
    });
  });

  it('DERIVED portrait RESIZE: materializes portrait AND re-validates the already-designed landscape (design §6.2)', async () => {
    // wi-1 (1x1) and a neighbour wi-2 (1x1 at landscape (1,0)) are landscape-only (portrait derived). Editing
    // wi-1 in portrait materializes portrait; because it also RESIZES to 2x2, wi-1's PRESERVED landscape origin
    // (0,0) would now overlap wi-2 at (1,0), so landscape is re-validated to the nearest free 2x2 slot too.
    const editedStored = { w: 1, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 } } };
    const boardRows: Row[] = [
      { id: 'wi-1', service_id: 'clock', widget_type: 'clock', size: 'small', config: {}, rect: editedStored as never, refresh: null },
      {
        id: 'wi-2',
        service_id: 'clock',
        widget_type: 'clock',
        size: 'small',
        config: {},
        rect: { w: 1, h: 1, z: 0, pos: { landscape: { x: 1, y: 0 } } } as never,
        refresh: null,
      },
    ];
    const { updates, updateEqCalls } = mockPersist(editedStored, boardRows);

    await persistInstanceLayout('wi-1', { rect: { x: 0, y: 1, w: 2, h: 2, z: 0 }, size: 'L' }, 'portrait');

    // Materialize order: the non-edited wi-2 first (rect-only, portrait stamped), then the edited wi-1.
    expect(updateEqCalls).toEqual([
      ['id', 'wi-2'],
      ['id', 'wi-1'],
    ]);
    // wi-2: rect ONLY (footprint unchanged), portrait stamped from the reflow, landscape preserved.
    expect(updates[0]).toEqual({
      rect: { w: 1, h: 1, z: 0, pos: { landscape: { x: 1, y: 0 }, portrait: { x: 1, y: 0 } } },
    });
    // wi-1: the new portrait edit (0,1) AND landscape re-validated from (0,0) -> (0,1), clear of wi-2 at (1,0).
    expect(updates[1]).toEqual({
      rect: { w: 2, h: 2, z: 0, pos: { landscape: { x: 0, y: 1 }, portrait: { x: 0, y: 1 } } },
      size: 'large',
    });
  });

  it('DERIVED portrait: MATERIALIZES the board (rect-only for others) then writes the edited instance last', async () => {
    // Two landscape-designed rows (portrait derived). Editing in portrait materializes the reflow.
    const boardRows: Row[] = [
      {
        id: 'wi-1',
        service_id: 'clock',
        widget_type: 'clock',
        size: 'medium',
        config: {},
        rect: { w: 2, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 } } } as never,
        refresh: null,
      },
      {
        id: 'wi-2',
        service_id: 'clock',
        widget_type: 'clock',
        size: 'medium',
        config: {},
        rect: { w: 2, h: 1, z: 0, pos: { landscape: { x: 2, y: 0 } } } as never,
        refresh: null,
      },
    ];
    // The edited row's own stored rect (portrait NOT designed -> the materialize path).
    const { updates, updateEqCalls } = mockPersist(
      { w: 2, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 } } },
      boardRows,
    );

    await persistInstanceLayout('wi-1', { rect: { x: 0, y: 1, w: 2, h: 1, z: 0 }, size: 'W' }, 'portrait');

    // Two UPDATEs: the non-edited wi-2 FIRST (rect-only, materialized portrait position), then the edited
    // wi-1 (rect + size, its NEW portrait position). Reflow of landscape [(0,0),(2,0)] into 4 cols keeps
    // wi-2 at (2,0); the edit moves wi-1 to (0,1).
    expect(updateEqCalls).toEqual([
      ['id', 'wi-2'],
      ['id', 'wi-1'],
    ]);
    // wi-2: rect ONLY (no size key — its footprint is unchanged), portrait stamped, landscape preserved.
    expect(updates[0]).toEqual({
      rect: { w: 2, h: 1, z: 0, pos: { landscape: { x: 2, y: 0 }, portrait: { x: 2, y: 0 } } },
    });
    expect('size' in updates[0]).toBe(false);
    // wi-1: rect + size, the edit's new portrait position, landscape preserved.
    expect(updates[1]).toEqual({
      rect: { w: 2, h: 1, z: 0, pos: { landscape: { x: 0, y: 0 }, portrait: { x: 0, y: 1 } } },
      size: 'medium',
    });
  });

  it('is a no-op when the edited row was deleted concurrently (select returns null)', async () => {
    const maybeSingle = jest.fn(async () => ({ data: null, error: null }));
    const update = jest.fn();
    (supabase.from as jest.Mock).mockReset().mockReturnValue({
      select: jest.fn(() => ({ eq: jest.fn(() => ({ maybeSingle })) })),
      update,
    });
    await expect(
      persistInstanceLayout('gone', { rect: { x: 0, y: 0, w: 1, h: 1, z: 0 }, size: 'S' }),
    ).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });
});

// AOD-141 (resolves AOD-104): the client-direct per-widget delete. The RLS grant + policy
// widget_instances_rw_own (`for all using (user_id = auth.uid())`) already cover DELETE, so the repo
// only issues delete().eq('id', ...) by id (dashboard_id untouched, like persistInstanceLayout/Config).
// These tests override the shared from() mock with a delete-aware chain and lock the id targeting + the
// error-propagation the optimistic hook relies on to roll back.
describe('deleteWidgetInstance: client-direct RLS delete by id (strips the instance from ALL orientations)', () => {
  it('deletes the widget_instances row by its id and resolves', async () => {
    const eq = jest.fn(async () => ({ error: null }));
    const del = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReset().mockReturnValue({ delete: del });

    await expect(deleteWidgetInstance('wi-42')).resolves.toBeUndefined();

    expect(supabase.from).toHaveBeenCalledWith('widget_instances');
    expect(del).toHaveBeenCalledTimes(1);
    // Targets by id only — never dashboard_id — so the §8 ownership check holds trivially and no other
    // instance (or the service connection) is affected.
    expect(eq).toHaveBeenCalledWith('id', 'wi-42');
  });

  it('throws when RLS/network rejects, so the hook can surface it and roll the tile back', async () => {
    const eq = jest.fn(async () => ({ error: new Error('rls denied') }));
    (supabase.from as jest.Mock).mockReset().mockReturnValue({ delete: jest.fn(() => ({ eq })) });

    await expect(deleteWidgetInstance('wi-42')).rejects.toThrow('rls denied');
  });
});

// AOD-146 (Many Skies §1d): the client-direct cross-sky re-parent. The RLS grant + policy
// widget_instances_rw_own (`for all using (user_id = auth.uid())`) already cover UPDATE, and the §8
// dashboard-ownership WITH CHECK already permits re-parenting to another OWNED dashboard, so the repo only
// issues update({ dashboard_id }).eq('id', ...) — like persistInstanceLayout, but writing the parent sky.
// These lock the id targeting, the dashboard_id-only payload (a move touches no geometry/size/config), and
// the error-propagation the optimistic move hook relies on to roll the card back.
describe('moveInstanceToDashboard: client-direct RLS re-parent by id', () => {
  function mockUpdate(error: Error | null = null) {
    const eq = jest.fn(async () => ({ error }));
    const captured: { payload?: Record<string, unknown> } = {};
    const update = jest.fn((payload: Record<string, unknown>) => {
      captured.payload = payload;
      return { eq };
    });
    (supabase.from as jest.Mock).mockReset().mockReturnValue({ update });
    return { captured, eq, update };
  }

  it('updates only dashboard_id, targeting the instance by id, and resolves', async () => {
    const { captured, eq, update } = mockUpdate();

    await expect(moveInstanceToDashboard('wi-7', 'd-dest')).resolves.toBeUndefined();

    expect(supabase.from).toHaveBeenCalledWith('widget_instances');
    expect(update).toHaveBeenCalledTimes(1);
    // The ONLY column touched is the parent sky — a move re-parents, it does not re-lay-out.
    expect(captured.payload).toEqual({ dashboard_id: 'd-dest' });
    // Targets by id (never dashboard_id in the filter), so RLS + the §8 ownership WITH CHECK hold trivially.
    expect(eq).toHaveBeenCalledWith('id', 'wi-7');
  });

  it('throws when RLS/network rejects (e.g. a move to a sky the user does not own), so the hook can roll back', async () => {
    mockUpdate(new Error('rls denied'));
    await expect(moveInstanceToDashboard('wi-7', 'd-dest')).rejects.toThrow('rls denied');
  });
});

// AOD-143 (Many Skies): the multi-dashboard data layer. These lock the repo's HALF of the contract — the raw
// RLS-scoped reads/writes — with the same focused per-test chain mocks the deleteWidgetInstance tests use.
// The last-sky rule and active-pointer policy live in useDashboards (tested there), not the repo.
describe('loadDashboards: the skies list (ordered by position)', () => {
  it('returns every dashboard as a summary, in position order, dropping instances', async () => {
    const rows = [
      { id: 'd1', name: 'Wall', position: 0 },
      { id: 'd2', name: '', position: 1 }, // a nameless sky (§1e) round-trips its empty name
      { id: 'd3', name: 'Travel', position: 2 },
    ];
    const order = jest.fn(async () => ({ data: rows, error: null }));
    const select = jest.fn(() => ({ order }));
    (supabase.from as jest.Mock).mockReset().mockReturnValue({ select });

    const result = await loadDashboards();

    expect(supabase.from).toHaveBeenCalledWith('dashboards');
    expect(select).toHaveBeenCalledWith('id, name, position');
    expect(order).toHaveBeenCalledWith('position', { ascending: true });
    expect(result).toEqual([
      { id: 'd1', name: 'Wall', position: 0 },
      { id: 'd2', name: '', position: 1 },
      { id: 'd3', name: 'Travel', position: 2 },
    ]);
  });

  it('returns an empty list (never throws) when the user has no dashboards', async () => {
    const order = jest.fn(async () => ({ data: null, error: null }));
    (supabase.from as jest.Mock).mockReset().mockReturnValue({ select: jest.fn(() => ({ order })) });
    await expect(loadDashboards()).resolves.toEqual([]);
  });
});

describe('loadDashboardById: the active-sky loader (by id)', () => {
  // Two tables: the dashboard row (by id) then its instances (by dashboard_id), like loadDashboard but keyed.
  function mockById(dash: { id: string; name: string } | null, wiRows: unknown[]) {
    const dashMaybeSingle = jest.fn(async () => ({ data: dash, error: null }));
    const dashEq = jest.fn(() => ({ maybeSingle: dashMaybeSingle }));
    const wiOrder = jest.fn(async () => ({ data: wiRows, error: null }));
    const wiEq = jest.fn(() => ({ order: wiOrder }));
    (supabase.from as jest.Mock).mockReset().mockImplementation((table: string) =>
      table === 'dashboards'
        ? { select: jest.fn(() => ({ eq: dashEq })) }
        : { select: jest.fn(() => ({ eq: wiEq })) },
    );
    return { dashEq, wiEq };
  }

  it('loads a specific sky and its instances, mapped through the boundary', async () => {
    const { dashEq, wiEq } = mockById({ id: 'd2', name: 'Travel' }, [
      {
        id: 'wi-9',
        dashboard_id: 'd2',
        service_id: 'clock',
        widget_type: 'clock',
        size: 'medium', // the frozen DB word; the mapper re-derives 'W' from the 2x1 rect
        config: {},
        rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
        refresh: null,
        created_at: '2026-07-17T00:00:00Z',
      },
    ]);

    const result = await loadDashboardById('d2');

    expect(dashEq).toHaveBeenCalledWith('id', 'd2');
    expect(wiEq).toHaveBeenCalledWith('dashboard_id', 'd2');
    expect(result).toEqual({
      dashboardId: 'd2',
      name: 'Travel',
      instances: [
        {
          instanceId: 'wi-9',
          serviceId: 'clock',
          widgetType: 'clock',
          config: {},
          size: 'W',
          rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
        },
      ],
    });
  });

  it('returns null when the id no longer resolves (a stale active pointer)', async () => {
    mockById(null, []);
    await expect(loadDashboardById('ghost')).resolves.toBeNull();
  });
});

describe('createDashboard: a new EMPTY sky at max(position)+1 (§1g)', () => {
  // from('dashboards') answers BOTH the max-position read (select->order->limit->maybeSingle) and the insert
  // (insert->select->single); the top-level select is the position read, the insert brings its own select.
  function mockCreate(lastPosition: number | null, echoed: { id: string; name: string; position: number }) {
    const posMaybeSingle = jest.fn(async () => ({
      data: lastPosition == null ? null : { position: lastPosition },
      error: null,
    }));
    const posLimit = jest.fn(() => ({ maybeSingle: posMaybeSingle }));
    const posOrder = jest.fn(() => ({ limit: posLimit }));
    const insertSingle = jest.fn(async () => ({ data: echoed, error: null }));
    const captured: { payload?: Record<string, unknown> } = {};
    const insert = jest.fn((payload: Record<string, unknown>) => {
      captured.payload = payload;
      return { select: jest.fn(() => ({ single: insertSingle })) };
    });
    (supabase.from as jest.Mock)
      .mockReset()
      .mockReturnValue({ select: jest.fn(() => ({ order: posOrder })), insert });
    return { captured, posOrder, posLimit };
  }

  it('inserts nameless at max+1 with no widget seed, and returns the summary', async () => {
    const { captured, posOrder, posLimit } = mockCreate(2, { id: 'd-new', name: '', position: 3 });

    const result = await createDashboard('u1');

    expect(posOrder).toHaveBeenCalledWith('position', { ascending: false });
    expect(posLimit).toHaveBeenCalledWith(1);
    // Nameless by default (§1e), appended at the end (§1g), with user_id for the §8 owner WITH CHECK.
    expect(captured.payload).toEqual({ user_id: 'u1', name: '', position: 3 });
    expect(result).toEqual({ id: 'd-new', name: '', position: 3 });
    // EMPTY: a new sky seeds NO Clock (only first-run bootstrapDashboard does) — no widget_instances write.
    expect(supabase.from).not.toHaveBeenCalledWith('widget_instances');
  });

  it('uses the provided name and positions after the current last sky', async () => {
    const { captured } = mockCreate(0, { id: 'd-2', name: 'Travel', position: 1 });
    const result = await createDashboard('u1', 'Travel');
    expect(captured.payload).toEqual({ user_id: 'u1', name: 'Travel', position: 1 });
    expect(result).toEqual({ id: 'd-2', name: 'Travel', position: 1 });
  });

  it('starts at position 0 when the user somehow has no existing sky', async () => {
    const { captured } = mockCreate(null, { id: 'd-0', name: '', position: 0 });
    await createDashboard('u1');
    expect(captured.payload).toEqual({ user_id: 'u1', name: '', position: 0 });
  });
});

describe('renameDashboard: update name by id (§1e)', () => {
  function mockUpdate() {
    const eq = jest.fn(async () => ({ error: null }));
    const captured: { payload?: Record<string, unknown> } = {};
    const update = jest.fn((payload: Record<string, unknown>) => {
      captured.payload = payload;
      return { eq };
    });
    (supabase.from as jest.Mock).mockReset().mockReturnValue({ update });
    return { captured, eq };
  }

  it('updates the name, targeting by id', async () => {
    const { captured, eq } = mockUpdate();
    await expect(renameDashboard('d1', 'Travel')).resolves.toBeUndefined();
    expect(supabase.from).toHaveBeenCalledWith('dashboards');
    expect(captured.payload).toEqual({ name: 'Travel' });
    expect(eq).toHaveBeenCalledWith('id', 'd1');
  });

  it('an empty string returns a sky to nameless', async () => {
    const { captured } = mockUpdate();
    await renameDashboard('d1', '');
    expect(captured.payload).toEqual({ name: '' });
  });
});

describe('reorderDashboards: write each row position to its index (§1e)', () => {
  it('writes position = array index for every id, in order', async () => {
    const eq = jest.fn(async () => ({ error: null }));
    const updates: Record<string, unknown>[] = [];
    const update = jest.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
      return { eq };
    });
    (supabase.from as jest.Mock).mockReset().mockReturnValue({ update });

    await reorderDashboards(['d3', 'd1', 'd2']);

    expect(updates).toEqual([{ position: 0 }, { position: 1 }, { position: 2 }]);
    expect(eq.mock.calls).toEqual([
      ['id', 'd3'],
      ['id', 'd1'],
      ['id', 'd2'],
    ]);
  });
});

describe('deleteDashboard: a single row delete (children cascade)', () => {
  it('deletes the dashboards row by id and touches no child table', async () => {
    const eq = jest.fn(async () => ({ error: null }));
    const del = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReset().mockReturnValue({ delete: del });

    await expect(deleteDashboard('d1')).resolves.toBeUndefined();

    expect(supabase.from).toHaveBeenCalledWith('dashboards');
    expect(del).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledWith('id', 'd1');
    // widget_instances + kiosk_configs cascade on dashboard_id (core_tables.sql §5.5/§5.6): no manual cleanup.
    expect(supabase.from).not.toHaveBeenCalledWith('widget_instances');
    expect(supabase.from).not.toHaveBeenCalledWith('kiosk_configs');
  });

  it('throws when RLS/network rejects', async () => {
    const eq = jest.fn(async () => ({ error: new Error('rls denied') }));
    (supabase.from as jest.Mock).mockReset().mockReturnValue({ delete: jest.fn(() => ({ eq })) });
    await expect(deleteDashboard('d1')).rejects.toThrow('rls denied');
  });
});
