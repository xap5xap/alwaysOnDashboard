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

// A dashboard WITHOUT its instances — the row shape the page-altitude "skies" list needs (Many Skies §1b):
// id + label + the swipe/dot order (§1e: position IS identity at the honest 2-3 sky count). Deliberately no
// instances: the list is drawn as thumbnails/dots, and loading every sky's widgets to render the switcher
// would be wasteful. `name` is '' for a nameless sky (§1e: skies are dots, the label is optional).
export interface DashboardSummary {
  id: string;
  name: string;
  position: number;
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

/** Load one dashboard's instances (by dashboard_id), validated + slot-coerced through the mapper. The shared
 *  body of loadDashboard / loadDashboardById: an invalid row is dropped, never crashes the layout (AOD-8
 *  §9 invariant 1). Registry-free — it names no service. */
async function loadInstancesFor(dashboardId: string): Promise<WidgetInstance[]> {
  const { data: rows, error } = await supabase
    .from('widget_instances')
    .select('*')
    .eq('dashboard_id', dashboardId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (rows ?? [])
    .map(rowToInstance)
    .filter((instance): instance is WidgetInstance => instance !== null);
}

/** Load the user's first dashboard (by position) and its instances, or null if they have none yet. The
 *  "first sky" fallback (AOD-143: useDashboard resolves the active sky, defaulting to this when the pointer
 *  is unset or names a deleted sky). Kept single (.limit(1)) for that default; the full list is loadDashboards. */
export async function loadDashboard(): Promise<LoadedDashboard | null> {
  const { data: dash, error } = await supabase
    .from('dashboards')
    .select('id, name')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!dash) return null;
  return { dashboardId: dash.id, name: dash.name, instances: await loadInstancesFor(dash.id) };
}

/** Load a SPECIFIC dashboard (by id) and its instances, or null if it does not exist / is not the user's
 *  (RLS scopes the select to auth.uid()). The active-sky loader (AOD-143): useDashboard reads the persisted
 *  active id and loads it here; a null return means the stored pointer is stale, so the caller falls back to
 *  the first sky. Same instance-loading body as loadDashboard, parameterized by id. */
export async function loadDashboardById(dashboardId: string): Promise<LoadedDashboard | null> {
  const { data: dash, error } = await supabase
    .from('dashboards')
    .select('id, name')
    .eq('id', dashboardId)
    .maybeSingle();
  if (error) throw error;
  if (!dash) return null;
  return { dashboardId: dash.id, name: dash.name, instances: await loadInstancesFor(dash.id) };
}

/** Load ALL of the user's dashboards as summaries (no instances), ordered by position — the page-altitude
 *  "skies" list (Many Skies §1b/§1e). RLS scopes the select to auth.uid(); the order is the swipe/dot order. */
export async function loadDashboards(): Promise<DashboardSummary[]> {
  const { data, error } = await supabase
    .from('dashboards')
    .select('id, name, position')
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d) => ({ id: d.id, name: d.name, position: d.position }));
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

/** Create a new, EMPTY dashboard for a Pro user (client-direct under RLS). Many Skies §1g: a new sky
 *  descends into an empty dashboard — NO Clock seed (only first-run bootstrapDashboard seeds; a deliberate
 *  create is not a first run). §1e: skies are dots, so the default name is '' (nameless) unless the caller
 *  passes a label. Inserts at position = max(existing) + 1 so the new sky lands at the END of the swipe order
 *  (positions are not unique per user, so max+1 is a valid append). Returns the summary; the hook sets it
 *  active so the view descends into it. */
export async function createDashboard(userId: string, name = ''): Promise<DashboardSummary> {
  const { data: last, error: posError } = await supabase
    .from('dashboards')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (posError) throw posError;
  const position = (last?.position ?? -1) + 1;

  const { data: dash, error } = await supabase
    .from('dashboards')
    .insert({ user_id: userId, name, position })
    .select('id, name, position')
    .single();
  if (error) throw error;
  return { id: dash.id, name: dash.name, position: dash.position };
}

/** Rename a dashboard the user owns (client-direct under RLS). Many Skies §1e: an empty string returns a sky
 *  to namelessness (the label is a note to self, clearable). Targets by id; RLS scopes the write to the owner. */
export async function renameDashboard(dashboardId: string, name: string): Promise<void> {
  const { error } = await supabase.from('dashboards').update({ name }).eq('id', dashboardId);
  if (error) throw error;
}

/** Persist a new sky order (Many Skies §1e: order here IS the swipe order and the dots' order everywhere).
 *  Writes each row's position to its index in `orderedIds`. Sequential so the intent is obvious; the honest
 *  case is 2-3 skies (§1a). Positions carry no per-user unique constraint, so no transient-collision hazard. */
export async function reorderDashboards(orderedIds: string[]): Promise<void> {
  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error } = await supabase
      .from('dashboards')
      .update({ position: index })
      .eq('id', orderedIds[index]);
    if (error) throw error;
  }
}

/** Delete a dashboard the user owns (client-direct under RLS). A raw row delete: widget_instances and
 *  kiosk_configs both reference dashboards.id ON DELETE CASCADE (core_tables.sql §5.5/§5.6), so the sky's
 *  cards and any wall config are removed by the DB — no manual child cleanup, no schema change. Connections
 *  are untouched (they belong to the account, not the sky — §1e "connections survive"). The LAST-SKY rule
 *  (§1e: the last sky can only be emptied, never deleted) is enforced by the caller (useDashboards), not
 *  here — the repo is the mechanism, the hook owns the policy. */
export async function deleteDashboard(dashboardId: string): Promise<void> {
  const { error } = await supabase.from('dashboards').delete().eq('id', dashboardId);
  if (error) throw error;
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

/** Delete ONE widget instance the user owns (AOD-141, resolves AOD-104). Client-direct under RLS: the
 *  grant and policy widget_instances_rw_own (`for all using (user_id = auth.uid())`) already cover DELETE,
 *  so no server change is needed. Targets by id only — the SAME per-row delete the disconnect broker does
 *  per-service (AOD-9 §10 / AOD-49), here a single instance from arrange mode. Connections are NOT touched:
 *  they belong to the account, not the card, so removing a widget never signs the user out of a service. */
export async function deleteWidgetInstance(instanceId: string): Promise<void> {
  const { error } = await supabase.from('widget_instances').delete().eq('id', instanceId);
  if (error) throw error;
}

/** Re-parent ONE widget instance to another dashboard the user owns (AOD-146, Many Skies §1d: carry a held
 *  card to the screen edge to move it between skies). The ONLY writer that changes a card's parent sky.
 *  Client-direct under RLS with no schema/RLS change: widget_instances_rw_own (`for all using (user_id =
 *  auth.uid())`) already covers UPDATE, and the §8 dashboard-ownership WITH CHECK (`dashboard_id in (select
 *  id from dashboards where user_id = auth.uid())`) already PERMITS re-parenting to another OWNED dashboard —
 *  a move to a sky the user does not own is rejected by that same check. Mirrors persistInstanceLayout's
 *  shape (update().eq('id', ...)) but writes dashboard_id; RLS scopes both the row and the destination to
 *  the owner, so no dashboard_id-ownership check is needed here. */
export async function moveInstanceToDashboard(instanceId: string, newDashboardId: string): Promise<void> {
  const { error } = await supabase
    .from('widget_instances')
    .update({ dashboard_id: newDashboardId })
    .eq('id', instanceId);
  if (error) throw error;
}
