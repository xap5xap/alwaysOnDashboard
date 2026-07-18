// The slot catalogue and the rect <-> size-class rules for the S/M/W/L slot grid (AOD-122, superseding
// the AOD-10 §5 free-class set). The design contract (Many Skies §1c, redesign-build-audit.md §1.1/§2.1):
// S 1x1 / M 1x2 / W 2x1 / L 2x2 on a TWO-COLUMN, 96px-row grid; the 3-wide banner class is retired.
// The rect (AOD-7) stays authoritative for geometry; the size id is the slot it occupies. Pure and
// I/O-free.
import type { LayoutRect, WidgetSize } from '../registry/types';

export interface SizeClassSpec {
  id: WidgetSize;
  nominalW: number;
  nominalH: number;
  nominalAspect: number;
}

// The slot grid is two columns wide; slots are at most two rows tall (L/M). Rows extend downward
// without bound (the sky scrolls); columns do not.
export const GRID_COLUMNS = 2;
const MAX_SLOT_H = 2;

// The Many Skies §1c slot contract (nominal units; aspect = w/h). Exactly four slots, no 3-wide.
export const SIZE_CATALOGUE: Record<WidgetSize, SizeClassSpec> = {
  S: { id: 'S', nominalW: 1, nominalH: 1, nominalAspect: 1.0 },
  M: { id: 'M', nominalW: 1, nominalH: 2, nominalAspect: 0.5 },
  W: { id: 'W', nominalW: 2, nominalH: 1, nominalAspect: 2.0 },
  L: { id: 'L', nominalW: 2, nominalH: 2, nominalAspect: 1.0 },
};

/** The slot id for an exact snapped extent. Total over w,h in {1,2}: 1x1 S, 1x2 M, 2x1 W, 2x2 L. */
function slotIdFor(w: number, h: number): WidgetSize {
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
 * {1..GRID_COLUMNS} x {1..MAX_SLOT_H}; x rounds and clamps into the two columns (x + w <= GRID_COLUMNS);
 * y rounds and clamps at 0 (rows are unbounded downward); z passes through. The slot id is derived
 * from the SNAPPED extent, so size and rect always agree. Legacy rows resolve as: small 1x1 -> S,
 * medium 2x1 -> W, tall 1x2 -> M, large 2x2 -> L, and the retired wide 3x1 clamps to W 2x1 (the
 * nearest legal horizontal slot). Free-drop fractional rects (the pre-slot arrange canvas) round to
 * the nearest slot the same way. Overlap between coerced neighbours is possible and allowed (z still
 * orders it); the slot-grid arrange rework owns reflow, not this read path.
 */
export function coerceToSlotGrid(rect: LayoutRect): { rect: LayoutRect; size: WidgetSize } {
  const w = clamp(Math.round(rect.w), 1, GRID_COLUMNS);
  const h = clamp(Math.round(rect.h), 1, MAX_SLOT_H);
  const x = clamp(Math.round(rect.x), 0, GRID_COLUMNS - w);
  const y = Math.max(0, Math.round(rect.y));
  return { rect: { x, y, w, h, z: rect.z }, size: slotIdFor(w, h) };
}

/**
 * Pick the supported slot whose nominal geometry best matches the rect (the AOD-10 §5.2 rule over the
 * AOD-122 catalogue). Distance is scale-invariant: aspect proximity dominates (primary), area proximity
 * breaks ties. supported[0] is the fallback seed. Still used by the live arrange path, which resizes
 * continuously and derives its size hint on release.
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
