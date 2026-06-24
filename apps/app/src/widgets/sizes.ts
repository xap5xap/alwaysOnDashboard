// The size catalogue and the rect <-> size-class reconciliation rule (AOD-10 §5). The rect (AOD-7)
// is authoritative for geometry; the size class is a quantized render hint chosen as the nearest
// supported class. Pure and I/O-free.
import type { LayoutRect, WidgetSize } from '../registry/types';

export interface SizeClassSpec {
  id: WidgetSize;
  nominalW: number;
  nominalH: number;
  nominalAspect: number;
}

// AOD-10 §5.1 canonical catalogue (nominal units; aspect = w/h).
export const SIZE_CATALOGUE: Record<WidgetSize, SizeClassSpec> = {
  small: { id: 'small', nominalW: 1, nominalH: 1, nominalAspect: 1.0 },
  medium: { id: 'medium', nominalW: 2, nominalH: 1, nominalAspect: 2.0 },
  large: { id: 'large', nominalW: 2, nominalH: 2, nominalAspect: 1.0 },
  wide: { id: 'wide', nominalW: 3, nominalH: 1, nominalAspect: 3.0 },
  tall: { id: 'tall', nominalW: 1, nominalH: 2, nominalAspect: 0.5 },
};

/**
 * Pick the supported class whose nominal geometry best matches the rect (AOD-10 §5.2). Distance is
 * scale-invariant: aspect proximity dominates (primary), area proximity breaks ties. supported[0]
 * is the fallback seed.
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
