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
  bootstrapDashboard,
  createDashboard,
  deleteDashboard,
  deleteWidgetInstance,
  loadDashboardById,
  loadDashboards,
  moveInstanceToDashboard,
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
      rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
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

// AOD-141 (resolves AOD-104): the client-direct per-widget delete. The RLS grant + policy
// widget_instances_rw_own (`for all using (user_id = auth.uid())`) already cover DELETE, so the repo
// only issues delete().eq('id', ...) by id (dashboard_id untouched, like persistInstanceLayout/Config).
// These tests override the shared from() mock with a delete-aware chain and lock the id targeting + the
// error-propagation the optimistic hook relies on to roll back.
describe('deleteWidgetInstance: client-direct RLS delete by id', () => {
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
