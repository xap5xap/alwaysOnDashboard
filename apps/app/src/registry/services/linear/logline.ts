// The Log Line's pure, React-free geometry (AOD-135; design-linear.md §6, claude-design/prompts/linear.md
// "The Log Line 21-knot ring"). The Current Cycle face is a SEGMENTED KNOT RING: one knot per cycle issue,
// the completed ones lit. These helpers are kept out of the leaf (the transit.ts / range.ts / soundings.ts
// precedent) so the knot MATH — the ring positions, the crowding-adaptive knot radius, the lit/total split,
// and the N=0 / N=1 / completed>total guards — is unit-testable and so no partial payload slips a NaN or a
// ÷0 through. The "21" in the card title is only an EXAMPLE: the knot count is ALWAYS totalCount, never a
// constant.
//
// NO colour here: the knots draw colors.accent (lit) / accent @ progress.trackOpacity (unlit) at the DRAW
// site (LogLineRing.tsx), so this stays a pure function of numbers. The ring is STATIC-per-render — the
// "one knot lights on refresh" settle is just the re-render with a higher completedCount, NOT an Animated /
// requestAnimationFrame loop (the AOD-72 RN-SVG `collapsable` leak; TransitArc.tsx header). Everything is
// computed ONCE from (completedCount, totalCount, geometry).

/** The ring's geometry inputs (DP). The leaf fits `outerRadius` to the host box (the AOD-81 fit-to-bounds
 *  lesson: never clip on the density-scaled device), capped by the per-size `theme.ring.radius`. */
export interface RingGeometry {
  /** The circle the knot CENTRES sit on (DP). */
  outerRadius: number;
  /** The ideal / max knot disc radius (DP): used for a small N, and as the STABLE box margin so the SVG
   *  extent does not change as the knots shrink for a larger N. */
  knotRadius: number;
  /** The knot disc radius FLOOR (DP): a large N shrinks toward this so the knots stay visible, never 0. */
  minKnotRadius: number;
  /** The minimum gap between two adjacent knot EDGES (DP): the crowding cap input. */
  minGap: number;
}

/** One knot on the ring: its index, its angle (radians, clockwise from the top), its centre, and whether
 *  the issue it stands for is completed (lit). */
export interface Knot {
  index: number;
  angle: number;
  x: number;
  y: number;
  lit: boolean;
}

/** The resolved ring: the knots, the ADAPTED disc radius actually drawn, the clamped lit/total, the ring
 *  centre (cx == cy), the circle the knots sit on, the square SVG extent, and the lit fraction (for the
 *  smooth Dead-Reckoning arc). */
export interface RingLayout {
  knots: Knot[];
  knotRadius: number;
  litCount: number;
  total: number;
  center: number;
  outerRadius: number;
  size: number;
  fraction: number;
}

/**
 * Clamp (completedCount, totalCount) to (lit, total): `total` a non-negative integer (the knot count),
 * `lit` in [0, total]. Guards completed > total (clamped down), completed < 0 (clamped to 0), and a
 * non-finite input (→ 0). Shared by the ring AND the W dashes so both read the same lit/total logic.
 */
export function resolveLit(completedCount: number, totalCount: number): { total: number; lit: number } {
  const total = Number.isFinite(totalCount) ? Math.max(0, Math.floor(totalCount)) : 0;
  const completed = Number.isFinite(completedCount) ? Math.floor(completedCount) : 0;
  return { total, lit: Math.max(0, Math.min(total, completed)) };
}

/**
 * The crowding-adaptive knot disc radius. For N <= 1 there is no neighbour to crowd, so the full
 * `knotRadius` is used (a 1-issue cycle still reads as a single solid knot). For N >= 2 the largest disc
 * that still leaves `minGap` between adjacent knots is taken and clamped to [minKnotRadius, knotRadius]:
 * the centre-to-centre chord along the ring is arcSpacing = 2π·outerRadius / N, so the widest disc is
 * (arcSpacing − minGap) / 2. So a small N wears the full knot, a large N shrinks toward the floor.
 */
export function adaptiveKnotRadius(total: number, geo: RingGeometry): number {
  if (total <= 1) return geo.knotRadius;
  const arcSpacing = (2 * Math.PI * geo.outerRadius) / total;
  const maxR = (arcSpacing - geo.minGap) / 2;
  return Math.max(geo.minKnotRadius, Math.min(geo.knotRadius, maxR));
}

/**
 * The ring layout: `total` knots equally spaced clockwise from the top (12 o'clock), the first `lit` of
 * them marked completed. SVG space is y-down, so a knot at angle θ (clockwise from top) is at
 * (center + R·sinθ, center − R·cosθ): θ=0 is the top, θ=π/2 the right (3 o'clock), θ=π the bottom. The
 * box margin uses the token `knotRadius` (the max), so `size` is STABLE across N even as the drawn discs
 * shrink. N=0 yields no knots (the percent carries the number); no division by zero anywhere.
 *
 * `maxKnots` (default ∞) is an OOM/ANR ceiling: when `total` exceeds it the per-issue knot array is NOT
 * built (`knots: []`) — the leaf renders the O(1) smooth arc for a huge / pathological totalCount instead,
 * so a garbage payload never allocates a per-issue array (a raw 1e9 → JS-heap OOM without this; resolveLit
 * clamps sign/finiteness but NOT magnitude). `total` / `litCount` / `fraction` stay the TRUE values, so the
 * card's counts remain honest above the cap — only the DRAWN figure collapses.
 */
export function ringLayout(
  completedCount: number,
  totalCount: number,
  geo: RingGeometry,
  maxKnots = Infinity,
): RingLayout {
  const { total, lit } = resolveLit(completedCount, totalCount);
  const center = geo.outerRadius + geo.knotRadius; // margin = the token (max) knot radius → stable extent
  const size = center * 2;
  const knotRadius = adaptiveKnotRadius(total, geo);

  // The OOM/ANR guard: above `maxKnots` the per-issue array is NOT built — the leaf draws the O(1) smooth
  // arc for a huge / pathological cycle instead. At or below the ceiling, one knot per issue as usual.
  const knots: Knot[] = [];
  if (total <= maxKnots) {
    for (let i = 0; i < total; i++) {
      const angle = (i / total) * 2 * Math.PI; // i=0 → 0 (top), regardless of N; single knot sits at the top
      knots.push({
        index: i,
        angle,
        x: center + geo.outerRadius * Math.sin(angle),
        y: center - geo.outerRadius * Math.cos(angle),
        lit: i < lit,
      });
    }
  }

  return {
    knots,
    knotRadius,
    litCount: lit,
    total,
    center,
    outerRadius: geo.outerRadius,
    size,
    fraction: total > 0 ? lit / total : 0,
  };
}
