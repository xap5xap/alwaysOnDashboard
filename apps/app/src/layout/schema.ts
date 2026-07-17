// The one validation layer (AOD-25) for the layout jsonb persisted in widget_instances
// (data-model §5.5: rect / refresh validated by Zod). These guard the rect/refresh/size blobs on
// every read and write so a malformed value never enters the layout engine or the database. The
// per-instance config-vs-widget-schema check is a separate concern owned by the host (validateConfig,
// AOD-10 §4.2); here config is validated only for structural shape (a JSON object).
import { z } from 'zod';
import type { LayoutRect, RefreshInterval, WidgetSize } from '../registry/types';

const coord = z.number().finite(); // x / y / z: any finite number
const dimension = z.number().finite().positive(); // w / h: a positive extent

// AOD-8 §7 LayoutRect. The rect is authoritative for geometry (AOD-7); unknown keys are stripped.
export const LayoutRectSchema: z.ZodType<LayoutRect> = z.object({
  x: coord,
  y: coord,
  w: dimension,
  h: dimension,
  z: coord,
});

// AOD-10 §3 per-placement RefreshInterval override: a positive-second cadence or "manual".
export const RefreshIntervalSchema: z.ZodType<RefreshInterval> = z.union([
  z.object({ seconds: z.number().finite().positive() }),
  z.literal('manual'),
]);

// The AOD-122 S/M/W/L slot catalogue (Many Skies §1c): what the app-side layout engine speaks.
export const WidgetSizeSchema: z.ZodType<WidgetSize> = z.enum(['S', 'M', 'W', 'L']);

// The DB column vocabulary: the widget_instances size CHECK (data-model §5.5, migration
// 20260623190259) is FROZEN on the pre-redesign five classes — AOD-122 ships with NO migration, so
// writes serialize S/M/W/L into this set (mapper.ts SIZE_TO_DB, an exact geometric bijection) and
// reads gate on it before the slot coercion. Retire this alongside a future CHECK migration.
export const DB_WIDGET_SIZES = ['small', 'medium', 'large', 'wide', 'tall'] as const;
export type DbWidgetSize = (typeof DB_WIDGET_SIZES)[number];
export const DbWidgetSizeSchema = z.enum(DB_WIDGET_SIZES);

// config is opaque per-instance values; structurally it is a JSON object (AOD-10 §4 owns its interior).
export const WidgetConfigSchema = z.record(z.unknown());
