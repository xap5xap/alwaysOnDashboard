// The first-run bootstrap seed at the DB boundary (AOD-126, resolves AOD-94): a fresh signup used to
// seed the walking-skeleton stub; it now seeds the Clock, the sole authClass 'none' widget, because a
// new user has no connections and the seed must render without one. Locks the exact inserted rows
// (dashboard + instance) and the seed's coherence with the REAL registry: a supported size whose rect
// matches the size's nominal geometry, avoiding the known-broken 1x1 `small` (hosted-dogfood finding),
// and a config that is born valid. Only the supabase client is mocked; mapper validation runs real.
import { bootstrapDashboard } from '../dashboardRepo';
import { getWidgetDef } from '../../registry/registry';
import { SIZE_CATALOGUE } from '../../widgets/sizes';
import { validateConfig } from '../../widgets/config';
import type { WidgetSize } from '../../registry/types';

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
  it('creates the Wall dashboard and seeds exactly one Clock instance (medium 2x1 at the origin, empty config)', async () => {
    const result = await bootstrapDashboard('u1');

    expect(inserts.dashboards).toEqual({ user_id: 'u1', name: 'Wall', position: 0 });
    expect(inserts.widget_instances).toEqual({
      dashboard_id: 'dash-1',
      user_id: 'u1',
      service_id: 'clock',
      widget_type: 'clock',
      size: 'medium',
      config: {},
      rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
      refresh: null,
    });

    // The mapped result the dashboard paints: the seed round-trips rowToInstance untouched.
    expect(result).toEqual({
      dashboardId: 'dash-1',
      name: 'Wall',
      instances: [
        {
          instanceId: 'wi-1',
          serviceId: 'clock',
          widgetType: 'clock',
          config: {},
          size: 'medium',
          rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
        },
      ],
    });
  });

  it('the seed coheres with the real registry: a supported non-small Clock size, nominal rect, valid config', async () => {
    await bootstrapDashboard('u1');
    const row = inserts.widget_instances as {
      service_id: string;
      widget_type: string;
      size: WidgetSize;
      rect: { w: number; h: number };
      config: Record<string, unknown>;
    };

    // The seed resolves against the REAL registry (AOD-8 §9 invariant 1: no orphan instance on signup).
    const def = getWidgetDef(row.service_id, row.widget_type);
    expect(def).toBeDefined();
    expect(def!.supportedSizes).toContain(row.size);

    // The rect is the seeded size's nominal geometry (SIZE_CATALOGUE), so size and rect agree.
    const spec = SIZE_CATALOGUE[row.size];
    expect({ w: row.rect.w, h: row.rect.h }).toEqual({ w: spec.nominalW, h: spec.nominalH });

    // Known dogfood finding (NOT fixed here): Clock overflows a 1x1 cell, so the seed must avoid `small`.
    expect(row.size).not.toBe('small');

    // Born valid: every Clock field is optional/defaulted, so {} passes and the host never opens on
    // needs_config for a brand-new user.
    expect(validateConfig(def!.configSchema, row.config).ok).toBe(true);
  });
});
