// The Soundings face's pure, React-free selectors (AOD-134; design-linear.md §4, claude-design/prompts/
// linear.md "the priority glyph = My Issues' distinctive mark", the RB-M2 runbook §5 AOD-134 card). The
// centerpiece of Soundings is a priority-mark SILHOUETTE: every assigned issue's priority glyph in ONE
// horizontal row, sorted HEAVY→LIGHT, capped to what fits the width (never clipped). These helpers are kept
// out of the leaf (the transit.ts / range.ts precedent) so the sort order + the packing cap are
// unit-testable, and so no partial payload slips a NaN through the comparator. NO colour here — the marks
// are drawn bone / shape-only by PriorityGlyph at the draw site (§4.2: priority is carried by SHAPE, never
// hue; a coloured-priority-dot rainbow would break the one-accent rule + the status-hue reservation), so
// this stays a pure function of numbers.

/**
 * The heavy→light sort WEIGHT for a Linear priority. Linear's numbering is INVERTED (integration-linear.md
 * §4.1: 0 none, 1 urgent, 2 high, 3 medium, 4 low), so a plain numeric sort is WRONG — urgent(1) is the
 * HEAVIEST and none(0) is the LIGHTEST, not the other way round. The weight is ASCENDING over the four real
 * levels (urgent 1 … low 4) with none — and any out-of-range / NaN value, which priorityShape() also
 * collapses to 'none' — mapped to Infinity so it sorts LAST. Mirroring priorityShape's none-bucket keeps the
 * sort and the drawn glyph in agreement (a value that renders as the none-dashes also sorts as none).
 */
export function priorityWeight(priority: number): number {
  return priority >= 1 && priority <= 4 ? priority : Infinity; // 1..4 real; else (0 none / NaN / oob) → last
}

/**
 * Sort issues HEAVY→LIGHT by priority (urgent > high > medium > low > none), STABLE for ties (equal
 * priorities keep their original relative order). Pure: returns a NEW array and never mutates the input (the
 * query data). Generic over the priority-bearing shape so it is testable with a minimal fixture. Stability
 * is explicit via an index decoration, which also dodges the Infinity − Infinity = NaN trap that a bare
 * subtractive comparator would hit on two 'none' issues.
 */
export function sortByPriorityHeavyToLight<T extends { priority: number }>(issues: readonly T[]): T[] {
  return issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => {
      const wa = priorityWeight(a.issue.priority);
      const wb = priorityWeight(b.issue.priority);
      if (wa !== wb) return wa - wb; // ascending weight = heavy→light (Infinity − finite is +∞ → none trails)
      return a.index - b.index; // tie (incl. Infinity === Infinity for two nones): keep source order → stable
    })
    .map((d) => d.issue);
}

/**
 * How many silhouette marks of `markSize` (px, DP) with `gap` between them fit in `width` (px, DP), so the
 * silhouette NEVER clips: n marks occupy n·markSize + (n−1)·gap ≤ width, so n = ⌊(width + gap) / (markSize +
 * gap)⌋. Clamped at 0 (a degenerate / zero width shows no marks, never a negative count). The caller caps the
 * heavy→light list to this, so the HEAVIEST marks are the ones kept when there are more issues than fit — the
 * count carries the true total; the silhouette is the priority TEXTURE, not the tally.
 */
export function silhouetteCapacity(width: number, markSize: number, gap: number): number {
  if (!(width > 0) || !(markSize > 0)) return 0;
  return Math.max(0, Math.floor((width + gap) / (markSize + gap)));
}
