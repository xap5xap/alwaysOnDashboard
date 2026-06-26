// Default placement for a freshly added widget instance (AOD-10 §5.1/§5.2 size + §4.1 config defaults).
// Pure and I/O-free: given a WidgetDefinition and the instances already on the board, it derives the
// InstanceSeed the dashboard repo inserts. This is the only add-widget code that reads a
// WidgetDefinition; dashboardRepo stays registry-free and just persists the seed (the AOD-8 §10 seam).
// Placement is functional, not final: precise drag-to-place is DS-M1 (AOD-7); a non-overlapping default
// slot is enough here.
import { SIZE_CATALOGUE } from '../widgets/sizes';
import type {
  LayoutRect,
  WidgetConfigSchema,
  WidgetDefinition,
  WidgetInstance,
  WidgetSize,
} from '../registry/types';
import type { InstanceSeed } from './mapper';

/**
 * The size class a new placement uses (AOD-10 §5.2): the "default card" `medium` when the widget
 * supports it, otherwise the first declared size. Falls back to `medium` for a (malformed) empty set.
 * Preferring `medium` keeps an added stub aligned with the bootstrap STUB_SEED, which is also `medium`.
 */
export function defaultPlacementSize(supported: WidgetSize[]): WidgetSize {
  if (supported.includes('medium')) return 'medium';
  return supported[0] ?? 'medium';
}

/**
 * A non-overlapping rect for a new instance: the chosen size's nominal w/h (SIZE_CATALOGUE) placed at
 * x=0 directly below every existing instance and on top of the z-stack. Stacking below guarantees the
 * new rect cannot overlap an existing one (its top is at or past every existing bottom). On an empty
 * board the first widget lands at the origin, matching the bootstrap seed.
 */
export function defaultPlacementRect(size: WidgetSize, existing: WidgetInstance[]): LayoutRect {
  const spec = SIZE_CATALOGUE[size];
  const y = existing.length ? Math.max(...existing.map((i) => i.rect.y + i.rect.h)) : 0;
  const z = existing.length ? Math.max(...existing.map((i) => i.rect.z)) + 1 : 0;
  return { x: 0, y, w: spec.nominalW, h: spec.nominalH, z };
}

/**
 * The schema's field defaults (AOD-10 §4.1), applied generically across field kinds. The stub declares
 * no fields, so this is `{}`. A required field with no default is left unset on purpose: the per-instance
 * config form (AOD-10 §4) owns collecting it, and the host renders needs_config until it is provided.
 */
export function defaultConfig(schema: WidgetConfigSchema): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (field.default !== undefined) config[field.key] = field.default;
  }
  return config;
}

/** Build the InstanceSeed for adding `def` to a board that already holds `existing` (all derived). */
export function defaultSeedFor(def: WidgetDefinition, existing: WidgetInstance[]): InstanceSeed {
  const size = defaultPlacementSize(def.supportedSizes);
  return {
    serviceId: def.serviceId,
    widgetType: def.type,
    config: defaultConfig(def.configSchema),
    size,
    rect: defaultPlacementRect(size, existing),
  };
}
