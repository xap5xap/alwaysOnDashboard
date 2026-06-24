// The typed boundary between widget_instances DB rows (snake_case, rect/config/refresh as jsonb) and
// the AOD-8 WidgetInstance the layout engine and host operate on. Reads validate through schema.ts and
// DROP an instance whose rect/size/refresh is malformed (AOD-8 §9 invariant 1: an unresolved/invalid
// instance is dropped, never crashes the layout). Writes re-validate, so no malformed geometry is ever
// persisted. This module names no service; it only reshapes data.
import type { Json, Tables, TablesInsert, TablesUpdate } from '@vela/shared';
import type {
  LayoutRect,
  RefreshInterval,
  WidgetInstance,
  WidgetSize,
} from '../registry/types';
import { LayoutRectSchema, RefreshIntervalSchema, WidgetSizeSchema } from './schema';

type InstanceRow = Tables<'widget_instances'>;

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

/** DB row -> WidgetInstance, or null if the row's geometry/size/refresh fails validation (drop it). */
export function rowToInstance(row: InstanceRow): WidgetInstance | null {
  const rect = LayoutRectSchema.safeParse(row.rect);
  if (!rect.success) return null;

  const size = WidgetSizeSchema.safeParse(row.size);
  if (!size.success) return null;

  let refresh: RefreshInterval | undefined;
  if (row.refresh != null) {
    const parsed = RefreshIntervalSchema.safeParse(row.refresh);
    if (!parsed.success) return null;
    refresh = parsed.data;
  }

  return {
    instanceId: row.id,
    serviceId: row.service_id,
    widgetType: row.widget_type,
    config: asConfigObject(row.config),
    rect: rect.data,
    size: size.data,
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
    size: WidgetSizeSchema.parse(seed.size),
    config: seed.config as Json,
    rect: LayoutRectSchema.parse(seed.rect) as unknown as Json,
    refresh: seed.refresh === undefined ? null : (RefreshIntervalSchema.parse(seed.refresh) as unknown as Json),
  };
}

/** Build a validated UPDATE for a geometry/size change. rect+size always set; refresh only if present. */
export function layoutToUpdate(patch: LayoutPatch): TablesUpdate<'widget_instances'> {
  const update: TablesUpdate<'widget_instances'> = {
    rect: LayoutRectSchema.parse(patch.rect) as unknown as Json,
    size: WidgetSizeSchema.parse(patch.size),
  };
  if ('refresh' in patch) {
    update.refresh =
      patch.refresh == null ? null : (RefreshIntervalSchema.parse(patch.refresh) as unknown as Json);
  }
  return update;
}
