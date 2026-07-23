// The one validation layer (AOD-25) for the layout jsonb persisted in widget_instances
// (data-model §5.5: rect / refresh validated by Zod). These guard the rect/refresh/size blobs on
// every read and write so a malformed value never enters the layout engine or the database. The
// per-instance config-vs-widget-schema check is a separate concern owned by the host (validateConfig,
// AOD-10 §4.2); here config is validated only for structural shape (a JSON object).
import { z } from 'zod';
import type { LayoutRect, RefreshInterval, WidgetSize } from '../registry/types';

const coord = z.number().finite(); // x / y / z: any finite number
const dimension = z.number().finite().positive(); // w / h: a positive extent

// AOD-8 §7 LayoutRect. The rect is authoritative for geometry (AOD-7); unknown keys are stripped. This is
// the FLAT resolved rect the render surfaces and the wall consume (design §6.5) AND the legacy bare stored
// shape (read as landscape-designed below); kept as-is.
export const LayoutRectSchema: z.ZodType<LayoutRect> = z.object({
  x: coord,
  y: coord,
  w: dimension,
  h: dimension,
  z: coord,
});

// --- AOD-197 per-orientation stored rect (design §6.4) -------------------------------------------
// The persisted `widget_instances.rect` jsonb grows from the legacy bare {x,y,w,h,z} to carry the SHARED
// footprint (w,h,z -> size) plus a POSITION per DESIGNED orientation. Client-only, NO DB migration: the
// column stays jsonb, the frozen `size` CHECK is untouched. At least one orientation position must be
// present ("at least one orientation is always designed"). This schema/normalizer is the whole persistence
// reshape; the render boundary stays a flat LayoutRect (mapper resolves one).

/** A stored per-orientation position (grid origin). */
export interface StoredPos {
  x: number;
  y: number;
}
/** The position per designed orientation; at least one present (validated by PerOrientationRectSchema). */
export interface PerOrientationPos {
  landscape?: StoredPos;
  portrait?: StoredPos;
}
/** The normalized stored rect: shared footprint (w,h,z) + a position per designed orientation. The shape
 *  both the read resolver (resolveInstances) and the write serializer (storedRectToJson) speak. */
export interface NormalizedStoredRect {
  w: number;
  h: number;
  z: number;
  pos: PerOrientationPos;
}

const posSchema = z.object({ x: coord, y: coord });

// The NEW per-orientation shape: shared footprint + a `pos` map with at least one orientation present. The
// refine is the "at least one designed" invariant; a `pos: {}` (no orientations) is malformed and rejected.
export const PerOrientationRectSchema = z
  .object({
    w: dimension,
    h: dimension,
    z: coord,
    pos: z.object({
      landscape: posSchema.optional(),
      portrait: posSchema.optional(),
    }),
  })
  .refine((r) => r.pos.landscape !== undefined || r.pos.portrait !== undefined, {
    message: 'at least one orientation position is required',
    path: ['pos'],
  });

// The READ-side union: the new per-orientation shape OR a legacy bare {x,y,w,h,z}. Order matters — the
// per-orientation shape is tried first (a rect carrying a valid `pos` is the new shape); a legacy bare rect
// has no `pos`, fails the refine, and falls through to LayoutRectSchema. A rect matching NEITHER (e.g. a
// `pos:{}` with no x,y, or a non-finite coord) is rejected, so the row drops (AOD-8 §9) — never a silent
// overlap. A valid legacy AND a valid new-shape rect both survive: the data-safety guarantee this reshape
// rests on.
export const StoredRectSchema = z.union([PerOrientationRectSchema, LayoutRectSchema]);

/** Normalize a parsed stored rect to the {w,h,z,pos} shape. A legacy bare rect reads as LANDSCAPE-DESIGNED
 *  (its x,y become pos.landscape) — existing dogfood boards were arranged on the landscape Fire HD 8 / iPad,
 *  so the single stored layout is landscape; portrait derives until designed (design §6.4, §12). No
 *  write-back, no data loss. */
export function normalizeStoredRect(parsed: z.infer<typeof StoredRectSchema>): NormalizedStoredRect {
  if ('pos' in parsed) {
    return {
      w: parsed.w,
      h: parsed.h,
      z: parsed.z,
      // Reconstruct pos with only the present orientations, so `pos[o] !== undefined` == "designed for o".
      pos: {
        ...(parsed.pos.landscape !== undefined ? { landscape: parsed.pos.landscape } : {}),
        ...(parsed.pos.portrait !== undefined ? { portrait: parsed.pos.portrait } : {}),
      },
    };
  }
  return { w: parsed.w, h: parsed.h, z: parsed.z, pos: { landscape: { x: parsed.x, y: parsed.y } } };
}

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
