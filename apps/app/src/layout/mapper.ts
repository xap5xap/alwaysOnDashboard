// The typed boundary between widget_instances DB rows (snake_case, rect/config/refresh as jsonb) and
// the AOD-8 WidgetInstance the layout engine and host operate on. Reads validate through schema.ts and
// DROP an instance whose rect/size/refresh is malformed (AOD-8 §9 invariant 1: an unresolved/invalid
// instance is dropped, never crashes the layout). Writes re-validate, so no malformed geometry is ever
// persisted. This module names no service; it only reshapes data.
//
// AOD-122: this boundary also translates size vocabularies. The app speaks the S/M/W/L slot grid
// (Many Skies §1c); the DB column CHECK is frozen on the legacy five words (no migration shipped).
// Reads gate on the DB vocabulary, then coerce the authoritative rect onto the slot grid
// (coerceToSlotGrid), so legacy layouts and the first-run seed render at legal slot sizes with no
// write-back. Writes serialize the slot id to its exact geometric legacy twin (SIZE_TO_DB below).
//
// AOD-197: the persisted rect grows to carry a POSITION per DESIGNED orientation plus one SHARED footprint
// (schema.ts NormalizedStoredRect), client-only (no DB migration). This module owns the two halves of that:
//  - READ: rowToStoredInstance parses the stored shape (legacy bare rect reads as landscape-designed) into
//    a StoredInstance holding BOTH orientations; resolveInstances then resolves a board for ONE requested
//    orientation into a flat WidgetInstance[] — stored positions if that orientation is DESIGNED, else the
//    reflow of a designed one (design §6). The render boundary (WidgetInstance.rect) stays a flat LayoutRect
//    (design §6.5). The requested orientation DEFAULTS to 'landscape', so the wall + all live reads are
//    byte-identical to pre-AOD-197.
//  - WRITE: instanceToInsert / layoutToUpdate / storedRectToUpdate serialize the new shape; mergeStoredRect
//    + buildAddPos + parseStoredRect are the pure helpers dashboardRepo's read-modify-write mutations use.
import type { Json, Tables, TablesInsert, TablesUpdate } from '@vela/shared';
import type {
  LayoutRect,
  RefreshInterval,
  WidgetInstance,
  WidgetSize,
} from '../registry/types';
import {
  coerceToSlotGrid,
  columnsFor,
  ORIENTATIONS,
  type Orientation,
} from '../widgets/sizes';
import { firstFreeSlot, reflowToColumns } from './grid';
import {
  DbWidgetSizeSchema,
  PerOrientationRectSchema,
  RefreshIntervalSchema,
  StoredRectSchema,
  WidgetConfigSchema as WidgetConfigStructSchema,
  WidgetSizeSchema,
  normalizeStoredRect,
  type DbWidgetSize,
  type NormalizedStoredRect,
  type PerOrientationPos,
  type StoredPos,
} from './schema';

type InstanceRow = Tables<'widget_instances'>;

// The write-side size serialization: each slot's exact geometric twin in the frozen DB vocabulary
// (S 1x1=small, M 1x2=tall, W 2x1=medium, L 2x2=large). Lossless because the rect rides beside it and
// the read path re-derives the slot from the rect; 'wide' (3x1) is never written — it has no slot.
const SIZE_TO_DB: Record<WidgetSize, DbWidgetSize> = {
  S: 'small',
  M: 'tall',
  W: 'medium',
  L: 'large',
};

/** A geometry/size patch the layout engine persists for one instance (rect authoritative, size derived).
 *  The RENDER-boundary patch (a flat resolved rect for the active orientation); dashboardRepo turns it into
 *  the per-orientation stored shape via a read-modify-write. */
export interface LayoutPatch {
  rect: LayoutRect;
  size: WidgetSize;
  // omitted = leave refresh untouched; null = clear the override; value = set it.
  refresh?: RefreshInterval | null;
}

/**
 * A parsed widget_instances row carrying the FULL per-orientation record (both positions) + the shared
 * footprint (AOD-197). The intermediate between a DB row and a resolved WidgetInstance: rowToStoredInstance
 * produces it (gating + normalizing), resolveInstances collapses a board of them onto one orientation.
 */
export interface StoredInstance {
  instanceId: string;
  serviceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  w: number;
  h: number;
  z: number;
  pos: PerOrientationPos;
  refresh?: RefreshInterval;
}

function asConfigObject(value: Json): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Is `orientation` DESIGNED for this board? True iff EVERY instance has a stored position for it (the
 *  all-or-none invariant, design §6.1). An empty board is treated as NOT designed (both branches resolve
 *  to []). Any partial/mixed state (some but not all) reads as NOT designed, so resolveInstances takes the
 *  reflow path and never drops or overlaps an instance. */
function isDesignedFor(stored: StoredInstance[], orientation: Orientation): boolean {
  return stored.length > 0 && stored.every((s) => s.pos[orientation] !== undefined);
}

/** DB row -> StoredInstance, or null if the row's geometry/size/refresh fails validation (drop it, AOD-8
 *  §9 invariant 1). The stored rect is parsed via StoredRectSchema (the new per-orientation shape OR a
 *  legacy bare rect) and normalized (legacy -> landscape-designed); the size string is a DB-vocabulary gate
 *  only (an unknown string still drops the row); refresh is validated when present. NEVER coerces here — a
 *  StoredInstance holds the raw stored footprint/positions; coercion onto the slot grid happens per
 *  orientation in resolveInstances (so the same footprint coerces identically wherever it lands). */
export function rowToStoredInstance(row: InstanceRow): StoredInstance | null {
  const parsed = StoredRectSchema.safeParse(row.rect);
  if (!parsed.success) return null;

  if (!DbWidgetSizeSchema.safeParse(row.size).success) return null;

  let refresh: RefreshInterval | undefined;
  if (row.refresh != null) {
    const parsedRefresh = RefreshIntervalSchema.safeParse(row.refresh);
    if (!parsedRefresh.success) return null;
    refresh = parsedRefresh.data;
  }

  const norm = normalizeStoredRect(parsed.data);
  return {
    instanceId: row.id,
    serviceId: row.service_id,
    widgetType: row.widget_type,
    config: asConfigObject(row.config),
    w: norm.w,
    h: norm.h,
    z: norm.z,
    pos: norm.pos,
    ...(refresh !== undefined ? { refresh } : {}),
  };
}

/** Assemble a resolved WidgetInstance from a StoredInstance + its coerced slot for the requested
 *  orientation. The render boundary: a flat LayoutRect + the slot-derived size (design §6.5). */
function storedToInstance(
  s: StoredInstance,
  slot: { rect: LayoutRect; size: WidgetSize },
): WidgetInstance {
  return {
    instanceId: s.instanceId,
    serviceId: s.serviceId,
    widgetType: s.widgetType,
    config: s.config,
    rect: slot.rect,
    size: slot.size,
    ...(s.refresh !== undefined ? { refresh: s.refresh } : {}),
  };
}

/**
 * Resolve a BOARD of StoredInstances onto ONE requested orientation into flat WidgetInstances (design §6).
 * The whole per-orientation model surfaces here; every render surface (wall, Glance, Arrange) consumes the
 * flat result exactly as today (design §6.5). `orientation` DEFAULTS to 'landscape' so the wall + all live
 * reads are byte-identical to pre-AOD-197.
 *
 *  - DESIGNED (every instance has pos[orientation]): use the stored positions — WYSIWYG, remembered. Each
 *    position + the shared footprint is coerced onto the orientation's slot grid (coerceToSlotGrid), exactly
 *    as the pre-AOD-197 read did for landscape, so a legacy (landscape-designed) board resolves BYTE-IDENTICAL
 *    landscape rects (the wall guarantee).
 *  - DERIVED (this orientation is NOT designed for every instance, incl. a partial/mixed state): reflow the
 *    DESIGNED source orientation into this one (reflowToColumns, design §6.3), so a spread-out layout packs
 *    "one next to the other". The source is the OTHER orientation (the designed one under the all-or-none
 *    invariant); per-instance the source position falls back to this orientation's own pos, then the origin,
 *    so even a corrupted mixed state resolves deterministically by reading order with NO overlap and NO drop.
 *
 * NEVER drops a valid instance (dropping is only for schema-invalid rows, in rowToStoredInstance). Preserves
 * input order (index-aligned), so callers can zip resolved rects back onto the stored instances.
 */
export function resolveInstances(
  stored: StoredInstance[],
  orientation: Orientation = 'landscape',
): WidgetInstance[] {
  const columns = columnsFor(orientation);

  if (isDesignedFor(stored, orientation)) {
    return stored.map((s) => {
      const pos = s.pos[orientation] as StoredPos;
      const slot = coerceToSlotGrid({ x: pos.x, y: pos.y, w: s.w, h: s.h, z: s.z }, columns);
      return storedToInstance(s, slot);
    });
  }

  const source: Orientation = orientation === 'landscape' ? 'portrait' : 'landscape';
  const sourceRects: LayoutRect[] = stored.map((s) => {
    const p = s.pos[source] ?? s.pos[orientation] ?? { x: 0, y: 0 };
    return { x: p.x, y: p.y, w: s.w, h: s.h, z: s.z };
  });
  const reflowed = reflowToColumns(sourceRects, columns);
  return stored.map((s, i) => storedToInstance(s, coerceToSlotGrid(reflowed[i], columns)));
}

/** DB row -> a WidgetInstance resolved for `orientation` (default landscape), or null if the row is
 *  malformed. A single-row convenience over rowToStoredInstance + resolveInstances for the insert paths
 *  (bootstrap / addWidget) that get one row back; board reads use resolveInstances directly so a derived
 *  orientation reflows the WHOLE board. For a landscape-designed (legacy or freshly inserted) row this is
 *  byte-identical to the pre-AOD-197 rowToInstance. */
export function rowToInstance(
  row: InstanceRow,
  orientation: Orientation = 'landscape',
): WidgetInstance | null {
  const stored = rowToStoredInstance(row);
  if (!stored) return null;
  return resolveInstances([stored], orientation)[0] ?? null;
}

/** Placement fields for seeding a new instance (the DB owns id/timestamps). The rect carries the shared
 *  footprint (w,h,z) and the ACTIVE orientation's position (x,y); addWidgetInstance turns it into a
 *  per-orientation stored rect (a pos per active + each other designed orientation). */
export interface InstanceSeed {
  serviceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  size: WidgetSize;
  rect: LayoutRect;
  refresh?: RefreshInterval;
}

/** Serialize a normalized per-orientation stored rect to the validated jsonb the column stores (AOD-197).
 *  PerOrientationRectSchema.parse THROWS on a malformed rect (a non-positive extent, a non-finite coord, or
 *  an empty `pos`), matching the write-validates invariant — no bad geometry is ever persisted. */
export function storedRectToJson(stored: NormalizedStoredRect): Json {
  return PerOrientationRectSchema.parse(stored) as unknown as Json;
}

/** Merge a per-orientation position + the shared footprint into a stored rect, PRESERVING the other
 *  orientation's position (design §6.1: a commit writes the active orientation, the other is remembered).
 *  The core write helper for a commit in a designed orientation and for the edited instance in materialize. */
export function mergeStoredRect(
  base: NormalizedStoredRect,
  orientation: Orientation,
  pos: StoredPos,
  footprint: { w: number; h: number; z: number },
): NormalizedStoredRect {
  return {
    w: footprint.w,
    h: footprint.h,
    z: footprint.z,
    pos: { ...base.pos, [orientation]: { x: pos.x, y: pos.y } },
  };
}

/** Parse + normalize a raw stored rect jsonb (the read half of dashboardRepo's read-modify-write mutations),
 *  or null when the stored value is malformed. Same gate as rowToStoredInstance's rect step, standalone. */
export function parseStoredRect(raw: unknown): NormalizedStoredRect | null {
  const parsed = StoredRectSchema.safeParse(raw);
  return parsed.success ? normalizeStoredRect(parsed.data) : null;
}

/**
 * The per-orientation position map for ADDING a new instance (design §6.1): place it in the ACTIVE
 * orientation at the seed's position, AND — for every OTHER orientation that is DESIGNED — at that
 * orientation's firstFreeSlot among the existing instances' positions there (so every designed orientation
 * stays complete, and the wall's landscape always has a slot for every card). A DERIVED orientation gets NO
 * stored position: it simply re-reflows to include the new card on the next read. On a board where only the
 * active orientation is designed (the S3 live case: landscape-only), this returns just `{ [active]: seed }`.
 * Pure; dashboardRepo passes the board's existing StoredInstances.
 */
export function buildAddPos(
  seed: InstanceSeed,
  active: Orientation,
  existing: StoredInstance[],
): PerOrientationPos {
  const pos: PerOrientationPos = {};
  pos[active] = { x: seed.rect.x, y: seed.rect.y };
  for (const other of ORIENTATIONS) {
    if (other === active) continue;
    if (!isDesignedFor(existing, other)) continue;
    const occupied = existing.map((s) => {
      const p = s.pos[other] as StoredPos;
      return { x: p.x, y: p.y, w: s.w, h: s.h };
    });
    const slot = firstFreeSlot({ w: seed.rect.w, h: seed.rect.h }, occupied, columnsFor(other));
    pos[other] = { x: slot.x, y: slot.y };
  }
  return pos;
}

/** Build a validated INSERT row (AOD-197). user_id is required by the NOT NULL column and the §8 WITH
 *  CHECK. `pos` carries the position per designed orientation (buildAddPos); the shared footprint comes from
 *  the seed's rect. The size string serializes to the frozen DB vocabulary (SIZE_TO_DB), untouched. */
export function instanceToInsert(
  seed: InstanceSeed,
  dashboardId: string,
  userId: string,
  pos: PerOrientationPos,
): TablesInsert<'widget_instances'> {
  const storedRect: NormalizedStoredRect = { w: seed.rect.w, h: seed.rect.h, z: seed.rect.z, pos };
  return {
    dashboard_id: dashboardId,
    user_id: userId,
    service_id: seed.serviceId,
    widget_type: seed.widgetType,
    // Validate the slot id, then serialize it into the frozen DB vocabulary (AOD-122, SIZE_TO_DB).
    size: SIZE_TO_DB[WidgetSizeSchema.parse(seed.size)],
    config: seed.config as Json,
    rect: storedRectToJson(storedRect),
    refresh: seed.refresh === undefined ? null : (RefreshIntervalSchema.parse(seed.refresh) as unknown as Json),
  };
}

/** Build a validated UPDATE for a per-instance config change (AOD-10 §4). config is structurally
 *  validated as a JSON object (data-model §5.5: the per-kind interior is the host's validateConfig
 *  concern, AOD-10 §4.2; here we only guard the blob shape, like the rect/size guards). Sits beside
 *  layoutToUpdate so the config-update path is symmetric with the geometry-update path. */
export function configToUpdate(config: Record<string, unknown>): TablesUpdate<'widget_instances'> {
  return { config: WidgetConfigStructSchema.parse(config) as Json };
}

/** A geometry/size UPDATE over the per-orientation stored rect (AOD-197). dashboardRepo builds the merged
 *  storedRect (preserving the other orientation) and passes the render-boundary size + refresh through. */
export interface StoredLayoutPatch {
  storedRect: NormalizedStoredRect;
  size: WidgetSize;
  // omitted = leave refresh untouched; null = clear the override; value = set it.
  refresh?: RefreshInterval | null;
}

/** Build a validated UPDATE for a geometry/size change (AOD-197). rect (the whole per-orientation stored
 *  shape) + size always set; refresh only if the key is present. The slot-id -> frozen-DB-vocabulary
 *  serialization matches instanceToInsert (SIZE_TO_DB). */
export function layoutToUpdate(patch: StoredLayoutPatch): TablesUpdate<'widget_instances'> {
  const update: TablesUpdate<'widget_instances'> = {
    rect: storedRectToJson(patch.storedRect),
    size: SIZE_TO_DB[WidgetSizeSchema.parse(patch.size)],
  };
  if ('refresh' in patch) {
    update.refresh =
      patch.refresh == null ? null : (RefreshIntervalSchema.parse(patch.refresh) as unknown as Json);
  }
  return update;
}

/** Build an UPDATE that sets ONLY the rect jsonb (AOD-197). The materialize path uses this for the
 *  non-edited instances: it stamps their reflowed position for the newly-designed orientation WITHOUT
 *  touching their size column (their footprint is unchanged), so a materialize never rewrites a size. */
export function storedRectToUpdate(storedRect: NormalizedStoredRect): TablesUpdate<'widget_instances'> {
  return { rect: storedRectToJson(storedRect) };
}
