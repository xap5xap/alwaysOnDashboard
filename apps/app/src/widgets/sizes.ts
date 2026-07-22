// The slot catalogue and the rect <-> size-class rules for the S/M/W/L slot grid (AOD-122, superseding
// the AOD-10 §5 free-class set). The design contract (Many Skies §1c, redesign-build-audit.md §1.1/§2.1):
// S 1x1 / M 1x2 / W 2x1 / L 2x2 — footprints at most MAX_SLOT_W x MAX_SLOT_H (2x2); the 3-wide banner
// class is retired. AOD-197 makes the PLACEMENT grid responsive per orientation (GRID_COLUMNS wide in
// landscape, PORTRAIT_COLUMNS in portrait), a column COUNT kept DISTINCT from the footprint-width ceiling
// MAX_SLOT_W below (they were conflated when the grid was itself two columns wide). The rect (AOD-7) stays
// authoritative for geometry; the size id is the slot it occupies. Pure and I/O-free.
import type { LayoutRect, WidgetSize } from '../registry/types';

export interface SizeClassSpec {
  id: WidgetSize;
  nominalW: number;
  nominalH: number;
  nominalAspect: number;
}

// AOD-197 responsive placement grid. The column COUNT depends on orientation — GRID_COLUMNS wide in
// LANDSCAPE (the wall's orientation and the default), PORTRAIT_COLUMNS wide in portrait (design §4/§5) —
// while a widget FOOTPRINT spans at most MAX_SLOT_W x MAX_SLOT_H (a 2x2 L). These two concepts were
// conflated when the grid was itself two columns wide; they are now SEPARATE: the column count bounds an
// x-position and a placement scan, MAX_SLOT_W bounds a footprint's w (wider-than-2 footprints are a
// deferred seam, design §13). Rows extend downward without bound (the sky scrolls); columns do not. All
// exported so the discrete snap/slot algebra (layout/geometry.ts, layout/grid.ts) shares one source of
// truth for the grid's shape rather than re-declaring the numbers across modules (AOD-138).
export const GRID_COLUMNS = 6; // landscape placement columns (Xavier's iPad Air 11", design §4)
export const PORTRAIT_COLUMNS = 4; // portrait placement columns (design §4)
export const MAX_SLOT_W = 2; // footprint width ceiling (S/M/W/L are <= 2 wide); NOT the column count
export const MAX_SLOT_H = 2; // footprint height ceiling (S/M/W/L are <= 2 tall)

// AOD-197 per-orientation placement (design §6). A layout stores a POSITION per orientation but ONE
// SHARED footprint; the column COUNT differs by orientation (landscape 6 / portrait 4). Landscape is the
// wall's orientation and the default everywhere in S3 — the resolution/persist orientation is a parameter
// that defaults to 'landscape', so the wall and every current live path stay byte-identical; S4 wires the
// real device orientation. These live here beside the column constants so there is one source of truth for
// the grid's shape (mapper/dashboardRepo/placement all read them).
export type Orientation = 'landscape' | 'portrait';

/** Both orientations in a stable order — landscape first (the wall's orientation and the default). */
export const ORIENTATIONS: readonly Orientation[] = ['landscape', 'portrait'];

/** The placement column count for an orientation: landscape GRID_COLUMNS (6), portrait PORTRAIT_COLUMNS (4). */
export function columnsFor(orientation: Orientation): number {
  return orientation === 'portrait' ? PORTRAIT_COLUMNS : GRID_COLUMNS;
}

// The Many Skies §1c slot contract (nominal units; aspect = w/h). Exactly four slots, no 3-wide.
export const SIZE_CATALOGUE: Record<WidgetSize, SizeClassSpec> = {
  S: { id: 'S', nominalW: 1, nominalH: 1, nominalAspect: 1.0 },
  M: { id: 'M', nominalW: 1, nominalH: 2, nominalAspect: 0.5 },
  W: { id: 'W', nominalW: 2, nominalH: 1, nominalAspect: 2.0 },
  L: { id: 'L', nominalW: 2, nominalH: 2, nominalAspect: 1.0 },
};

/** The slot id for an exact snapped extent. Total over w,h in {1,2}: 1x1 S, 1x2 M, 2x1 W, 2x2 L.
 *  Exported for the arrange commit path (AOD-140, layout/arrange.ts): after a reflow every rect is a
 *  legal slot (integer x/y, w/h in {1,2}), so its size id is exactly this — no reconcileSize search. */
export function slotIdFor(w: number, h: number): WidgetSize {
  if (w === 1) return h === 1 ? 'S' : 'M';
  return h === 1 ? 'W' : 'L';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * The AOD-122 read-time coercion: resolve ANY persisted rect onto the S/M/W/L slot grid, without a
 * write-back. Deterministic, geometry-driven (the rect is authoritative; the stored size string is
 * only a validation gate in the mapper): w/h round to the nearest slot extent and clamp into
 * {1..MAX_SLOT_W} x {1..MAX_SLOT_H}; x rounds and clamps into the active orientation's `columns`
 * (x + w <= columns); y rounds and clamps at 0 (rows are unbounded downward); z passes through. The slot
 * id is derived from the SNAPPED extent, so size and rect always agree. Legacy rows resolve as: small 1x1
 * -> S, medium 2x1 -> W, tall 1x2 -> M, large 2x2 -> L, and the retired wide 3x1 clamps to W 2x1 (the
 * footprint ceiling MAX_SLOT_W, the nearest legal horizontal slot). `columns` defaults to the landscape
 * GRID_COLUMNS so existing callers (mapper) keep resolving on the wall's orientation; S3 will pass the
 * real orientation's count. Widening landscape to 6 columns (AOD-197) means a legacy 2-column rect
 * coerces LEFT-ALIGNED into the wider grid with no overlap (design §12) — its x was already <= columns-w.
 * Free-drop fractional rects (the pre-slot arrange canvas) round to the nearest slot the same way. Overlap
 * between coerced neighbours is possible and allowed (z still orders it); the slot-grid arrange rework owns
 * reflow, not this read path.
 */
export function coerceToSlotGrid(
  rect: LayoutRect,
  columns: number = GRID_COLUMNS,
): { rect: LayoutRect; size: WidgetSize } {
  const w = clamp(Math.round(rect.w), 1, MAX_SLOT_W);
  const h = clamp(Math.round(rect.h), 1, MAX_SLOT_H);
  const x = clamp(Math.round(rect.x), 0, columns - w);
  const y = Math.max(0, Math.round(rect.y));
  return { rect: { x, y, w, h, z: rect.z }, size: slotIdFor(w, h) };
}

/**
 * Pick the supported slot whose nominal geometry best matches the rect (the AOD-10 §5.2 rule over the
 * AOD-122 catalogue). Distance is scale-invariant: aspect proximity dominates (primary), area proximity
 * breaks ties. supported[0] is the fallback seed. The general best-supported-slot matcher for a
 * free-form rect; since AOD-140 the live arrange resize snaps DISCRETELY to a supported footprint (it
 * derives its size id straight from the snapped extent, slotIdFor), so it no longer routes through here.
 */
export function reconcileSize(rect: Pick<LayoutRect, 'w' | 'h'>, supported: WidgetSize[]): WidgetSize {
  const aspect = rect.w / rect.h;
  const area = rect.w * rect.h;
  let best: WidgetSize = supported[0];
  let bestScore = Infinity;
  for (const id of supported) {
    const c = SIZE_CATALOGUE[id];
    const aspectTerm = Math.abs(Math.log(aspect / c.nominalAspect));
    const areaTerm = Math.abs(Math.log(area / (c.nominalW * c.nominalH)));
    const score = aspectTerm + 0.25 * areaTerm; // aspect dominates; area breaks ties
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}
