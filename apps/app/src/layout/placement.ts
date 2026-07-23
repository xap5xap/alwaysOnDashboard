// Default placement for a freshly added widget instance (AOD-10 §5.1/§5.2 size + §4.1 config defaults).
// Pure and I/O-free: given a WidgetDefinition and the instances already on the board, it derives the
// InstanceSeed the dashboard repo inserts. This is the only add-widget code that reads a
// WidgetDefinition; dashboardRepo stays registry-free and just persists the seed (the AOD-8 §10 seam).
// Placement is functional, not final: precise drag-to-place is DS-M1 (AOD-7); a non-overlapping default
// slot is enough here.
import { GRID_COLUMNS, SIZE_CATALOGUE } from '../widgets/sizes';
import { validateConfig } from '../widgets/config';
import type {
  LayoutRect,
  WidgetConfigSchema,
  WidgetDefinition,
  WidgetInstance,
  WidgetSize,
} from '../registry/types';
import { firstFreeSlot } from './grid';
import type { InstanceSeed } from './mapper';

/**
 * The size class a new placement uses (AOD-10 §5.2 rule over the AOD-122 slot grid): the "default
 * card" `W` (2x1, the full-width row — the geometric successor of the pre-slot `medium`) when the
 * widget supports it, otherwise the first declared size. Falls back to `W` for a (malformed) empty
 * set. Preferring `W` keeps an added widget aligned with the bootstrap first-run seed (dashboardRepo),
 * which is also `W`.
 */
export function defaultPlacementSize(supported: WidgetSize[]): WidgetSize {
  if (supported.includes('W')) return 'W';
  return supported[0] ?? 'W';
}

/**
 * A non-overlapping rect for a new instance: the chosen size's nominal w/h (SIZE_CATALOGUE) placed in
 * the FIRST FREE SLOT of the 2-column grid — reading order (row-major, top-to-bottom, left column first),
 * appending a fresh row below when no interior gap fits (grid.firstFreeSlot, AOD-138). This is the exact
 * rule the arrange reflow shows (Many Skies §2a: "lands at the first spot its size fits, the same rule the
 * reflow shows"), so a freshly added card and a reflowed card obey one law. It supersedes the AOD-103
 * 1-D append (`x=0`, stack below every instance), which never used column 2 and columned S/M cards.
 * The occupied set is every existing instance's grid CELL (z is irrelevant to fit — the scan reasons over
 * covered cells, not stacking). z keeps the top-of-stack rule (empty board = 0, else max z + 1): overlap
 * is impossible on the first-free grid, but the read path still orders any legacy overlap by z, so a new
 * card sits on top. On an empty board firstFreeSlot returns the origin, matching the bootstrap seed.
 */
export function defaultPlacementRect(
  size: WidgetSize,
  existing: WidgetInstance[],
  columns: number = GRID_COLUMNS,
): LayoutRect {
  const spec = SIZE_CATALOGUE[size];
  const occupied = existing.map((i) => ({ x: i.rect.x, y: i.rect.y, w: i.rect.w, h: i.rect.h }));
  const slot = firstFreeSlot({ w: spec.nominalW, h: spec.nominalH }, occupied, columns);
  const z = existing.length ? Math.max(...existing.map((i) => i.rect.z)) + 1 : 0;
  return { x: slot.x, y: slot.y, w: spec.nominalW, h: spec.nominalH, z };
}

/**
 * The schema's field defaults (AOD-10 §4.1), applied generically across field kinds. A schema with no
 * defaulted fields yields `{}`. A required field with no default is left unset on purpose: the per-instance
 * config form (AOD-10 §4) owns collecting it, and the host renders needs_config until it is provided.
 */
export function defaultConfig(schema: WidgetConfigSchema): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (field.default !== undefined) config[field.key] = field.default;
  }
  return config;
}

/**
 * Whether adding `schema` needs the config form before insert (AOD-10 §4): true when the schema's
 * defaults alone do not validate, i.e. a required field has no default. Reuses validateConfig and
 * defaultConfig, no new logic: a widget whose fields are all optional/defaulted (like the Clock) keeps
 * the AOD-51 add-with-defaults path; a required-no-default field routes through the form first so the
 * instance is born valid. Generic over the registry; never per-service.
 */
export function requiresConfiguration(schema: WidgetConfigSchema): boolean {
  return !validateConfig(schema, defaultConfig(schema)).ok;
}

/** Build the InstanceSeed for adding `def` to a board that already holds `existing`. `config` overrides
 *  the schema defaults when the configure-on-add form collected values (AOD-10 §4); omit for the
 *  add-with-defaults path (AOD-51). `size` overrides the default placement size (AOD-148 size-by-seeing:
 *  the gallery lands the card at the SELECTED S/M/W/L, not just the default); omit to keep
 *  `defaultPlacementSize`, so no other caller changes. The rect is always re-derived from the chosen size,
 *  so a bigger override still lands non-overlapping (firstFreeSlot). Geometry is always derived. */
export function defaultSeedFor(
  def: WidgetDefinition,
  existing: WidgetInstance[],
  config?: Record<string, unknown>,
  size?: WidgetSize,
  columns: number = GRID_COLUMNS,
): InstanceSeed {
  const chosen = size ?? defaultPlacementSize(def.supportedSizes);
  return {
    serviceId: def.serviceId,
    widgetType: def.type,
    config: config ?? defaultConfig(def.configSchema),
    size: chosen,
    // The seed's position lives in the ACTIVE orientation's grid (default landscape = GRID_COLUMNS); AOD-197
    // addWidgetInstance stores it as pos[active]. S4 passes the portrait count when adding in portrait.
    rect: defaultPlacementRect(chosen, existing, columns),
  };
}
