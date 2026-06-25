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

// The first-run default. Replaced by real onboarding + an add-widget flow in PS-M3; the stub exercises
// the AOD-8 seam and the AOD-10 host lifecycle without any real integration.
const DEFAULT_DASHBOARD_NAME = 'Wall';
const STUB_SEED: InstanceSeed = {
  serviceId: 'stub',
  widgetType: 'placeholder',
  config: {},
  size: 'medium',
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

/** Create the default dashboard + the stub instance for a user who has none (client-direct under RLS). */
export async function bootstrapDashboard(userId: string): Promise<LoadedDashboard> {
  const { data: dash, error } = await supabase
    .from('dashboards')
    .insert({ user_id: userId, name: DEFAULT_DASHBOARD_NAME, position: 0 })
    .select('id, name')
    .single();
  if (error) throw error;

  const { data: row, error: rowError } = await supabase
    .from('widget_instances')
    .insert(instanceToInsert(STUB_SEED, dash.id, userId))
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
