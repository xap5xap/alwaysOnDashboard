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
import type { Json, Tables, TablesInsert, TablesUpdate } from '@vela/shared';
import type {
  LayoutRect,
  RefreshInterval,
  WidgetInstance,
  WidgetSize,
} from '../registry/types';
import { coerceToSlotGrid } from '../widgets/sizes';
import {
  DbWidgetSizeSchema,
  LayoutRectSchema,
  RefreshIntervalSchema,
  WidgetConfigSchema as WidgetConfigStructSchema,
  WidgetSizeSchema,
  type DbWidgetSize,
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

/** A geometry/size patch the layout engine persists for one instance (rect authoritative, size derived). */
export interface LayoutPatch {
  rect: LayoutRect;
  size: WidgetSize;
  // omitted = leave refresh untouched; null = clear the override; value = set it.
  refresh?: RefreshInterval | null;
}

function asConfigObject(value: Json): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** DB row -> WidgetInstance, or null if the row's geometry/size/refresh fails validation (drop it).
 *  The surviving rect+size are the AOD-122 read-time coercion's output: the persisted rect snapped to
 *  the S/M/W/L slot grid, the slot id derived from the snapped extent. The stored size string is a
 *  vocabulary gate only (an unknown string still drops the row, AOD-8 §9 invariant 1); the rect is
 *  authoritative, so a legacy size/rect disagreement resolves to what the rect actually showed. */
export function rowToInstance(row: InstanceRow): WidgetInstance | null {
  const rect = LayoutRectSchema.safeParse(row.rect);
  if (!rect.success) return null;

  if (!DbWidgetSizeSchema.safeParse(row.size).success) return null;

  let refresh: RefreshInterval | undefined;
  if (row.refresh != null) {
    const parsed = RefreshIntervalSchema.safeParse(row.refresh);
    if (!parsed.success) return null;
    refresh = parsed.data;
  }

  const slot = coerceToSlotGrid(rect.data);
  return {
    instanceId: row.id,
    serviceId: row.service_id,
    widgetType: row.widget_type,
    config: asConfigObject(row.config),
    rect: slot.rect,
    size: slot.size,
    ...(refresh !== undefined ? { refresh } : {}),
  };
}

/** Placement fields for seeding a new instance (the DB owns id/timestamps). */
export interface InstanceSeed {
  serviceId: string;
  widgetType: string;
  config: Record<string, unknown>;
  size: WidgetSize;
  rect: LayoutRect;
  refresh?: RefreshInterval;
}

/** Build a validated INSERT row. user_id is required by the NOT NULL column and the §8 WITH CHECK. */
export function instanceToInsert(
  seed: InstanceSeed,
  dashboardId: string,
  userId: string,
): TablesInsert<'widget_instances'> {
  return {
    dashboard_id: dashboardId,
    user_id: userId,
    service_id: seed.serviceId,
    widget_type: seed.widgetType,
    // Validate the slot id, then serialize it into the frozen DB vocabulary (AOD-122, SIZE_TO_DB).
    size: SIZE_TO_DB[WidgetSizeSchema.parse(seed.size)],
    config: seed.config as Json,
    rect: LayoutRectSchema.parse(seed.rect) as unknown as Json,
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

/** Build a validated UPDATE for a geometry/size change. rect+size always set; refresh only if present. */
export function layoutToUpdate(patch: LayoutPatch): TablesUpdate<'widget_instances'> {
  const update: TablesUpdate<'widget_instances'> = {
    rect: LayoutRectSchema.parse(patch.rect) as unknown as Json,
    // Same slot-id -> frozen-DB-vocabulary serialization as instanceToInsert (AOD-122, SIZE_TO_DB).
    size: SIZE_TO_DB[WidgetSizeSchema.parse(patch.size)],
  };
  if ('refresh' in patch) {
    update.refresh =
      patch.refresh == null ? null : (RefreshIntervalSchema.parse(patch.refresh) as unknown as Json);
  }
  return update;
}
