// The Soundings face's pure, React-free selector (AOD-134; design-linear.md §4, claude-design/prompts/
// linear.md "the priority glyph = My Issues' distinctive mark", the RB-M2 runbook §5 AOD-134 card + the
// 2026-07-20 device RETUNE). Soundings now carries priority TWO ways: the per-row priority glyph inline next
// to each issue (so a mark is tied to a name), and — where there are no rows (S/W) or as an all-issue tally
// above them (L) — a worded priority SUMMARY ("9 High · 1 Med"): a textual histogram in heavy→light order.
// The RETUNE replaced the earlier aggregate priority-mark SILHOUETTE (one glyph per issue in a sorted row):
// on real data (9 High + 1 Med) the silhouette read as ~9 identical marks with no link to the named rows, so
// its sort/pack helpers were retired with it. This helper is kept out of the leaf (the transit.ts / range.ts
// precedent) so the bucketing + order are unit-testable, and so no partial payload slips a NaN through. NO
// colour here — the summary is drawn bone / monochrome at the draw site (numerals colors.text, labels
// colors.textMuted; §4.2 priority is carried by SHAPE/word, never a hue), so this stays a pure function.

/** One nonzero priority bucket in the worded summary: the level, its compact label, and how many issues fall
 *  in it. Only buckets with count ≥ 1 are returned, already ordered heavy→light. */
export interface PrioritySummarySegment {
  priority: number; // the Linear level this bucket counts (1 urgent, 2 high, 3 medium, 4 low, 0 none)
  label: string; // the compact display label ('Urgent' | 'High' | 'Med' | 'Low' | 'None')
  count: number; // issues in this bucket (always ≥ 1 in the returned list)
}

// The heavy→light display order + compact labels (integration-linear.md §4.1: Linear's numbering is INVERTED,
// so urgent(1) is HEAVIEST and none(0) LIGHTEST — none trails, NOT leads). 'Med' matches the RETUNE example
// "9 High · 1 Med"; the rest read in full since those buckets are usually short.
const SUMMARY_ORDER: readonly { priority: number; label: string }[] = [
  { priority: 1, label: 'Urgent' },
  { priority: 2, label: 'High' },
  { priority: 3, label: 'Med' },
  { priority: 4, label: 'Low' },
  { priority: 0, label: 'None' },
];

/**
 * Tally issues into the worded priority summary — the nonzero buckets in heavy→light order (urgent > high >
 * medium > low > none). Pure: never mutates the input (the query data). Any out-of-range / NaN priority folds
 * into 'none' (mirroring priorityShape()'s default, so a value that draws as the none-dashes also tallies as
 * none). Generic over the priority-bearing shape so it is testable with a minimal fixture. The count hero
 * carries the true total; this is the priority TEXTURE, in words that stay legible when every issue shares a
 * level (the failure the silhouette had).
 */
export function prioritySummary(issues: readonly { priority: number }[]): PrioritySummarySegment[] {
  const counts = new Map<number, number>();
  for (const { priority } of issues) {
    const bucket = priority >= 1 && priority <= 4 ? priority : 0; // 1..4 real; else (none / NaN / oob) → none
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return SUMMARY_ORDER.filter((b) => (counts.get(b.priority) ?? 0) > 0).map((b) => ({
    priority: b.priority,
    label: b.label,
    count: counts.get(b.priority)!,
  }));
}
