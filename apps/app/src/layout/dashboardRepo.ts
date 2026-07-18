// Client-direct dashboard + widget_instances access under RLS (data-model §8/§8.3: the client is the
// natural writer of layout state; owner CRUD with a dashboard-ownership WITH CHECK on instances).
// supabase-js carries the session JWT, so every query is scoped to auth.uid() automatically; inserts
// still set user_id explicitly because the column is NOT NULL and the WITH CHECK requires it. This is
// the data layer, not the layout engine: it references the bootstrap seed by string ids only and the
// engine never imports it. data-model §13 (whether layout mutations route through an Edge Function for
// uniform AOD-12 gating) stays open; here layout persists client-direct with no entitlement gating.
import { supabase } from '../supabase/client';
import type { WidgetInstance } from '../registry/types';
import {
  configToUpdate,
  instanceToInsert,
  layoutToUpdate,
  rowToInstance,
  type InstanceSeed,
  type LayoutPatch,
} from './mapper';

export interface LoadedDashboard {
  dashboardId: string;
  name: string;
  instances: WidgetInstance[];
}

// The first-run seed (AOD-126, resolves AOD-94): a fresh signup has no connections, so the seeded
// widget must be the one that renders without any — Clock, the sole authClass 'none' service
// (client-only, no fetch, self-ticks). Seeded `W` (2x1, AOD-122 slot vocabulary; the same origin
// rect the seed always had — pre-slot it was written `medium`, W's exact geometric twin, and the
// mapper still stores that word under the frozen DB CHECK): a supported Clock size whose nominal
// geometry matches; `S` (1x1) is supported but Clock is known to overflow a 1x1 cell (hosted-dogfood
// finding), so the seed avoids it. config {} is valid (every Clock field is optional/defaulted),
// keeping the bootstrap invariant that the seed is born valid. Interim choice: the onboarding cold
// open / skip-seeds decision refines this in RB-36.
const DEFAULT_DASHBOARD_NAME = 'Wall';
const FIRST_RUN_SEED: InstanceSeed = {
  serviceId: 'clock',
  widgetType: 'clock',
  config: {},
  size: 'W',
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

/** Load the user's first dashboard (by position) and its instances, or null if they have none yet. */
export async function loadDashboard(): Promise<LoadedDashboard | null> {
  const { data: dash, error } = await supabase
    .from('dashboards')
    .select('id, name')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!dash) return null;

  const { data: rows, error: rowsError } = await supabase
    .from('widget_instances')
    .select('*')
    .eq('dashboard_id', dash.id)
    .order('created_at', { ascending: true });
  if (rowsError) throw rowsError;

  const instances = (rows ?? [])
    .map(rowToInstance)
    .filter((instance): instance is WidgetInstance => instance !== null);

  return { dashboardId: dash.id, name: dash.name, instances };
}

/** Create the default dashboard + the first-run Clock instance for a user who has none (client-direct under RLS). */
export async function bootstrapDashboard(userId: string): Promise<LoadedDashboard> {
  const { data: dash, error } = await supabase
    .from('dashboards')
    .insert({ user_id: userId, name: DEFAULT_DASHBOARD_NAME, position: 0 })
    .select('id, name')
    .single();
  if (error) throw error;

  const { data: row, error: rowError } = await supabase
    .from('widget_instances')
    .insert(instanceToInsert(FIRST_RUN_SEED, dash.id, userId))
    .select('*')
    .single();
  if (rowError) throw rowError;

  const instance = rowToInstance(row);
  return { dashboardId: dash.id, name: dash.name, instances: instance ? [instance] : [] };
}

/** Add ONE widget instance to a dashboard the user owns (client-direct under RLS). Mirrors the bootstrap
 *  insert: validate the seed (mapper), set user_id explicitly for the §8 dashboard-ownership WITH CHECK,
 *  map the row back. Returns null only if the just-inserted row fails validation (it should not, since
 *  instanceToInsert re-validates on write). Registry-free: the caller derives the seed (placement.ts);
 *  this only persists it, so adding any service's widget never edits this file. */
export async function addWidgetInstance(
  dashboardId: string,
  userId: string,
  seed: InstanceSeed,
): Promise<WidgetInstance | null> {
  const { data: row, error } = await supabase
    .from('widget_instances')
    .insert(instanceToInsert(seed, dashboardId, userId))
    .select('*')
    .single();
  if (error) throw error;
  return rowToInstance(row);
}

/** Persist one instance's geometry/size (and refresh if included) under RLS. Targets by id only, so
 *  dashboard_id is never touched and the §8 dashboard-ownership WITH CHECK is trivially satisfied. */
export async function persistInstanceLayout(instanceId: string, patch: LayoutPatch): Promise<void> {
  const { error } = await supabase
    .from('widget_instances')
    .update(layoutToUpdate(patch))
    .eq('id', instanceId);
  if (error) throw error;
}

/** Persist one instance's config (AOD-10 §4) under RLS. Mirrors persistInstanceLayout exactly: targets
 *  by id only, so dashboard_id is untouched and the §8 dashboard-ownership WITH CHECK holds trivially.
 *  The caller validated the values with validateConfig (AOD-10 §4.2 place 1); this only persists them. */
export async function persistInstanceConfig(
  instanceId: string,
  config: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('widget_instances')
    .update(configToUpdate(config))
    .eq('id', instanceId);
  if (error) throw error;
}
