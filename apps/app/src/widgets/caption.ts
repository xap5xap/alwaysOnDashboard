// The per-widget caption resolver (AOD-124; claude-design/README.md §"the caption is per-widget"). PURE
// and I/O-free: a CaptionStrategy + the render context in, the header string (or `null` = a headerless
// card) out. No React, no theme, no registry — the resolver is a function of the leaf's declared strategy
// and { size, config, data, serviceName, title }, so the host stays generic (it branches on the strategy,
// never on a service) and every strategy is trivially testable.
//
// The caption carries the MOST USEFUL identifier, not a fixed SERVICE · WIDGET:
//   - hidden        → null at every size (chromeless; Clock is self-evident).
//   - serviceWidget → SERVICE · WIDGET, collapsed to one token when the title IS the service name.
//   - place         → SERVICE · <place> (Weather). The place comes from the payload (`data.place`) when
//                     present, else the config `labelKey` (WidgetHost merges the platform_key connection
//                     location, whose display name lives there, into the config it passes down).
//   - projectOrTeam → SERVICE · <project | team> (Linear). Reads the config `labelKey` a single-select
//                     remote-options field persisted at selection; reverts to the widget name when absent.
//   - calendar      → SERVICE · <calendar> (Calendar). Reads the config `labelKey` persisted at selection.
// Any non-hidden strategy resolves to `null` at a size in `hideAtSizes` (Weather / Calendar at S) — this
// is how the retired hideHeaderAtSizes is subsumed, size-aware, without a second field. The header style
// uppercases the returned string, so the resolver returns natural case (e.g. "Weather · Quito").
import type { CaptionStrategy, WidgetSize } from '../registry/types';

/** The default when a leaf declares no `caption`: the classic SERVICE · WIDGET header. */
export const DEFAULT_CAPTION_STRATEGY: CaptionStrategy = { kind: 'serviceWidget' };

export interface CaptionContext {
  /** The leaf's declared strategy (def.caption ?? DEFAULT_CAPTION_STRATEGY). */
  strategy: CaptionStrategy;
  /** The instance's slot size, for the size-gate (hideAtSizes). */
  size: WidgetSize;
  /** The widget title (def.title): the SERVICE · WIDGET component and the identifier-absent fallback. */
  title: string;
  /** The parent service's display name (the caption's leading token). */
  serviceName: string;
  /** The instance config the host passes down (merged with the connection config for platform_key). */
  config: Record<string, unknown>;
  /** The normalized payload on data-bearing states, else undefined; the place strategy prefers data.place. */
  data: unknown;
}

/** SERVICE · WIDGET, collapsed to one token when the widget title IS the service name (e.g. a legacy Clock). */
function collapse(serviceName: string, title: string): string {
  return title.toLowerCase() === serviceName.toLowerCase() ? serviceName : `${serviceName} · ${title}`;
}

/** A non-empty string, else undefined (a blank/missing identifier falls back to the widget name). */
function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/**
 * Resolve the caption to a header string, or `null` for a headerless card. Pure; the single source of the
 * SERVICE · WIDGET collapse and the size-gate. `null` from here is what makes the card chromeless — the
 * host suppresses the header row AND drops the header-height subtraction from the AOD-123 body box.
 */
export function resolveCaption(ctx: CaptionContext): string | null {
  const { strategy, size, title, serviceName, config, data } = ctx;

  // Chromeless at every size (Clock): no header, ever. Nothing else to resolve.
  if (strategy.kind === 'hidden') return null;

  // Size-gate (subsumes hideHeaderAtSizes): a resolvable strategy still yields null at a suppressed size.
  if (strategy.hideAtSizes?.includes(size)) return null;

  switch (strategy.kind) {
    case 'serviceWidget':
      return collapse(serviceName, title);
    case 'place': {
      // Prefer the payload's place (a future server-forwarded location lands here); else the config key
      // the host seeds from the platform_key connection. Absent (loading / no location) → the widget name.
      const place = nonEmpty((data as { place?: unknown } | null | undefined)?.place) ?? nonEmpty(config[strategy.labelKey]);
      return place ? `${serviceName} · ${place}` : collapse(serviceName, title);
    }
    case 'projectOrTeam':
    case 'calendar': {
      // The label persisted at config selection (the id and the payload both lack the human name). Absent
      // — never configured, i.e. the needs_config case — reverts to the widget name (SERVICE · WIDGET).
      const label = nonEmpty(config[strategy.labelKey]);
      return label ? `${serviceName} · ${label}` : collapse(serviceName, title);
    }
  }
}
