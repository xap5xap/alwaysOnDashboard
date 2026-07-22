// Client-direct dashboard + widget_instances access under RLS (data-model §8/§8.3: the client is the
// natural writer of layout state; owner CRUD with a dashboard-ownership WITH CHECK on instances).
// supabase-js carries the session JWT, so every query is scoped to auth.uid() automatically; inserts
// still set user_id explicitly because the column is NOT NULL and the WITH CHECK requires it. This is
// the data layer, not the layout engine: it references the bootstrap seed by string ids only and the
// engine never imports it. data-model §13 (whether layout mutations route through an Edge Function for
// uniform AOD-12 gating) stays open; here layout persists client-direct with no entitlement gating.
import { supabase } from '../supabase/client';
import type { WidgetInstance } from '../registry/types';
import { columnsFor, type Orientation } from '../widgets/sizes';
import {
  buildAddPos,
  configToUpdate,
  instanceToInsert,
  layoutToUpdate,
  mergeStoredRect,
  parseStoredRect,
  resolveInstances,
  rowToInstance,
  rowToStoredInstance,
  storedRectToUpdate,
  type InstanceSeed,
  type LayoutPatch,
  type StoredInstance,
  type StoredLayoutPatch,
} from './mapper';
import { nearestFreeSlot, type GridRect } from './grid';
import type { NormalizedStoredRect, StoredPos } from './schema';

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

/** Load one dashboard's instances (by dashboard_id) resolved for `orientation` (default 'landscape', the
 *  wall's orientation — so this is byte-identical to pre-AOD-197 for the wall + all live reads). The shared
 *  body of loadDashboard / loadDashboardById: each row parses to a StoredInstance (an invalid row is dropped,
 *  never crashes the layout — AOD-8 §9 invariant 1), then resolveInstances collapses the BOARD onto the
 *  requested orientation (stored positions if designed, else the whole-board reflow — design §6). Registry-free.
 *  S4 threads the real device orientation; here every caller keeps landscape via the default. */
async function loadInstancesFor(
  dashboardId: string,
  orientation: Orientation = 'landscape',
): Promise<WidgetInstance[]> {
  const { data: rows, error } = await supabase
    .from('widget_instances')
    .select('*')
    .eq('dashboard_id', dashboardId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const stored = (rows ?? [])
    .map(rowToStoredInstance)
    .filter((instance): instance is StoredInstance => instance !== null);
  return resolveInstances(stored, orientation);
}

/** Load the user's first dashboard (by position) and its instances, or null if they have none yet. The
 *  "first sky" fallback (AOD-143: useDashboard resolves the active sky, defaulting to this when the pointer
 *  is unset or names a deleted sky). Kept single (.limit(1)) for that default; the full list is loadDashboards. */
export async function loadDashboard(orientation: Orientation = 'landscape'): Promise<LoadedDashboard | null> {
  const { data: dash, error } = await supabase
    .from('dashboards')
    .select('id, name')
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!dash) return null;
  return { dashboardId: dash.id, name: dash.name, instances: await loadInstancesFor(dash.id, orientation) };
}

/** Load a SPECIFIC dashboard (by id) and its instances, or null if it does not exist / is not the user's
 *  (RLS scopes the select to auth.uid()). The active-sky loader (AOD-143): useDashboard reads the persisted
 *  active id and loads it here; a null return means the stored pointer is stale, so the caller falls back to
 *  the first sky. Same instance-loading body as loadDashboard, parameterized by id. */
export async function loadDashboardById(
  dashboardId: string,
  orientation: Orientation = 'landscape',
): Promise<LoadedDashboard | null> {
  const { data: dash, error } = await supabase
    .from('dashboards')
    .select('id, name')
    .eq('id', dashboardId)
    .maybeSingle();
  if (error) throw error;
  if (!dash) return null;
  return { dashboardId: dash.id, name: dash.name, instances: await loadInstancesFor(dash.id, orientation) };
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

  // A fresh board: the seed is placed in the active orientation only (landscape, the default; the wall's
  // orientation). Portrait derives by reflow until the user arranges it (design §6.1). buildAddPos over an
  // empty board yields just `{ landscape: {0,0} }` — the new-shape twin of the legacy bare origin rect.
  const pos = buildAddPos(FIRST_RUN_SEED, 'landscape', []);
  const { data: row, error: rowError } = await supabase
    .from('widget_instances')
    .insert(instanceToInsert(FIRST_RUN_SEED, dash.id, userId, pos))
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
  orientation: Orientation = 'landscape',
): Promise<WidgetInstance | null> {
  // Read the board so buildAddPos can place the card in EVERY OTHER designed orientation at its firstFreeSlot
  // (design §6.1 add — so every designed orientation stays complete; the wall's landscape always has a slot
  // for every card). A derived orientation gets no stored pos: it re-reflows to include the card on read. On
  // the S3 live path (active=landscape, portrait derived), this yields just `{ landscape: seed }` — one INSERT.
  const { data: rows, error: rowsError } = await supabase
    .from('widget_instances')
    .select('*')
    .eq('dashboard_id', dashboardId);
  if (rowsError) throw rowsError;
  const existing = (rows ?? [])
    .map(rowToStoredInstance)
    .filter((instance): instance is StoredInstance => instance !== null);

  const pos = buildAddPos(seed, orientation, existing);
  const { data: row, error } = await supabase
    .from('widget_instances')
    .insert(instanceToInsert(seed, dashboardId, userId, pos))
    .select('*')
    .single();
  if (error) throw error;
  return rowToInstance(row, orientation);
}

/**
 * Persist one instance's geometry/size (and refresh if included) for `orientation` (default 'landscape')
 * under RLS, as a per-orientation read-modify-write (AOD-197, design §6.1). The common path is a single
 * cheap UPDATE; the S3 LIVE path is always here (every board has landscape designed, and commit defaults to
 * landscape), so live behavior is byte-identical bar the richer jsonb.
 *
 *  1. SELECT the edited row's stored rect + its board.
 *  2. If the orientation is DESIGNED for this instance (pos[orientation] present — or the rect is
 *     unparseable, which we heal into a fresh designed rect): a single UPDATE that sets pos[orientation] +
 *     the shared footprint and PRESERVES pos[other]. This is the whole live path.
 *  3. If the orientation is DERIVED: MATERIALIZE-on-first-edit — commit the whole board's current reflow as
 *     this orientation's stored positions (footprint unchanged; rect-only UPDATE per non-edited instance,
 *     so no size is rewritten), then write the edited instance's NEW position + footprint + size. Multiple
 *     UPDATEs; NEVER happens on a landscape-only board, so the S3 live path stays step-2 cheap. Unit-tested
 *     for portrait.
 *
 * Targets by id only, so dashboard_id is never touched and the §8 dashboard-ownership WITH CHECK holds.
 */
export async function persistInstanceLayout(
  instanceId: string,
  patch: LayoutPatch,
  orientation: Orientation = 'landscape',
): Promise<void> {
  const { data: row, error: selError } = await supabase
    .from('widget_instances')
    .select('rect, dashboard_id')
    .eq('id', instanceId)
    .maybeSingle();
  if (selError) throw selError;
  if (!row) return; // the row was deleted concurrently; nothing to persist.

  const base = parseStoredRect(row.rect);
  const footprint = { w: patch.rect.w, h: patch.rect.h, z: patch.rect.z };
  const editedPos = { x: patch.rect.x, y: patch.rect.y };

  // Step 2 — designed (or an unparseable rect we heal): the common path is one UPDATE, preserving the other
  // orientation's stored position. AOD-197 (design §6.2, S4/Pass A): a RESIZE changes the SHARED footprint,
  // which can push the OTHER *designed* orientation's preserved position into overlap with a neighbour there
  // — so on a footprint change, re-validate it (nearestFreeSlot keeps it put if it still fits, else moves it
  // to the nearest free fitting cell). Gated so the common MOVE (no footprint change) stays a single cheap
  // UPDATE with NO board load: only when the footprint actually changed AND the other orientation is designed
  // for this instance (a stored pos[other] — which by the all-or-none invariant means designed board-wide).
  if (!base || base.pos[orientation] !== undefined) {
    const merged = mergeStoredRect(
      base ?? { w: footprint.w, h: footprint.h, z: footprint.z, pos: {} },
      orientation,
      editedPos,
      footprint,
    );
    const other: Orientation = orientation === 'landscape' ? 'portrait' : 'landscape';
    const otherPos = base?.pos[other];
    if (otherPos !== undefined && base != null && (base.w !== footprint.w || base.h !== footprint.h)) {
      const board = await loadStoredBoard(row.dashboard_id);
      merged.pos[other] = revalidatePos(board, instanceId, other, footprint, otherPos);
    }
    await updateInstanceRectAndSize(instanceId, merged, patch);
    return;
  }

  // Step 3 — derived: materialize the whole board's reflow, then apply the edit.
  const stored = await loadStoredBoard(row.dashboard_id);
  const resolvedById = new Map(
    resolveInstances(stored, orientation).map((instance) => [instance.instanceId, instance.rect]),
  );

  // Stamp every OTHER instance's reflowed position for the now-designed orientation (footprint unchanged →
  // rect-only UPDATE, size untouched). The edited instance is written last, with the patch's new geometry.
  for (const s of stored) {
    if (s.instanceId === instanceId) continue;
    const resolved = resolvedById.get(s.instanceId);
    const materialized = resolved ? { x: resolved.x, y: resolved.y } : (s.pos[orientation] ?? { x: 0, y: 0 });
    const merged: NormalizedStoredRect = {
      w: s.w,
      h: s.h,
      z: s.z,
      pos: { ...s.pos, [orientation]: materialized },
    };
    const { error } = await supabase
      .from('widget_instances')
      .update(storedRectToUpdate(merged))
      .eq('id', s.instanceId);
    if (error) throw error;
  }

  const editedMerged = mergeStoredRect(base, orientation, editedPos, footprint);
  // AOD-197 (design §6.2): if this first-edit-in-a-derived-orientation is also a RESIZE (footprint change),
  // the OTHER (already-designed, the reflow SOURCE) orientation's preserved position may now overlap —
  // re-validate it against the board we already loaded (no extra query). A plain move leaves it untouched.
  const otherDesigned: Orientation = orientation === 'landscape' ? 'portrait' : 'landscape';
  const otherStoredPos = base.pos[otherDesigned];
  if (otherStoredPos !== undefined && (base.w !== footprint.w || base.h !== footprint.h)) {
    editedMerged.pos[otherDesigned] = revalidatePos(stored, instanceId, otherDesigned, footprint, otherStoredPos);
  }
  await updateInstanceRectAndSize(instanceId, editedMerged, patch);
}

/** Load a board's parsed StoredInstances (AOD-197). The shared read for persistInstanceLayout's materialize
 *  path AND the step-2 resize re-validation: select every row for the dashboard, ordered by created_at (the
 *  stable reflow reading order), dropping any schema-invalid row (AOD-8 §9 invariant 1). */
async function loadStoredBoard(dashboardId: string): Promise<StoredInstance[]> {
  const { data: rows, error } = await supabase
    .from('widget_instances')
    .select('*')
    .eq('dashboard_id', dashboardId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (rows ?? [])
    .map(rowToStoredInstance)
    .filter((instance): instance is StoredInstance => instance !== null);
}

/** Re-validate ONE instance's stored position in `orientation` against its neighbours there, for its (possibly
 *  grown) footprint (AOD-197, design §6.2). The neighbours' stored positions in that orientation are the
 *  occupied cells; nearestFreeSlot keeps the instance's current cell if it still fits (no move — gaps
 *  preserved), else returns the nearest free fitting cell. Pure over the loaded board (skips the instance
 *  itself and any neighbour not designed in `orientation`). */
function revalidatePos(
  board: StoredInstance[],
  instanceId: string,
  orientation: Orientation,
  footprint: { w: number; h: number },
  current: StoredPos,
): StoredPos {
  const occupied: GridRect[] = [];
  for (const s of board) {
    if (s.instanceId === instanceId) continue;
    const p = s.pos[orientation];
    if (p === undefined) continue;
    occupied.push({ x: p.x, y: p.y, w: s.w, h: s.h });
  }
  const slot = nearestFreeSlot(
    { w: footprint.w, h: footprint.h },
    occupied,
    current,
    columnsFor(orientation),
  );
  return { x: slot.x, y: slot.y };
}

/** UPDATE one instance's rect (the whole per-orientation stored shape) + size (+ refresh when the patch
 *  carries the key), targeting by id. The shared tail of persistInstanceLayout's designed + materialize
 *  paths for the EDITED instance. */
async function updateInstanceRectAndSize(
  instanceId: string,
  storedRect: NormalizedStoredRect,
  patch: LayoutPatch,
): Promise<void> {
  const storedPatch: StoredLayoutPatch = { storedRect, size: patch.size };
  if ('refresh' in patch) storedPatch.refresh = patch.refresh;
  const { error } = await supabase
    .from('widget_instances')
    .update(layoutToUpdate(storedPatch))
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
