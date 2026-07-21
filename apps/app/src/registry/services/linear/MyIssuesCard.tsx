// The "My Issues" leaf renderer — the SOUNDINGS face (AOD-134; design-linear.md §4-5, claude-design/
// prompts/linear.md, the RB-M2 runbook §5 AOD-134 + the 2026-07-20 device RETUNE). Reached only on
// data-bearing lifecycle states (fresh / stale / error-with-data); the generic host draws every other
// state's chrome, including the host-drawn `empty` phase (isMyIssuesEmpty, the AOD-125 seam). It receives
// only { data, config, size, box } and never branches on auth, loading, or errors.
//
// Soundings keeps the §5.1 COUNT as the hero (the total bright + the filter qualifier muted) and carries
// priority TWO ways after the RETUNE:
//   1. INLINE per issue row: each M/L row leads with its own PriorityGlyph (M: glyph · title; L: glyph ·
//      identifier · title · due — the id/due are L affordances the narrow M column can't carry), so a mark is
//      tied to a name (the fix for the retired silhouette, whose aggregate marks floated above the rows).
//   2. A worded priority SUMMARY where there are no rows to carry the inline glyph (S/W) or as an all-issue
//      tally above them (L): "9 High · 1 Med" — prioritySummary (soundings.ts), the nonzero buckets in
//      heavy→light order. It stays legible when every issue shares a level (the failure the one-glyph-per-
//      issue silhouette had on real 9-High data), because it is WORDS, not repeated shapes.
// Priority is carried by SHAPE (the glyph) and WORD (the summary), never hue — both are bone / monochrome
// (glyph: filled = colors.text, ghost bars / none-dashes = colors.textMuted @ priorityIcon.offOpacity;
// summary: numerals colors.text, labels colors.textMuted). The card spends NO blue accent (a dense work list
// reads calmest as neutral monochrome, §5.1).
//
// Sizes (S/M/W/L): S count over the summary (the glance); W count + summary; M the count "spine" over
// glyph · title rows (no summary — the tall-narrow reading size, the inline glyph carries priority); L count +
// summary + up to a few glyph · id · title · due rows + "+N more". The row count stays HEIGHT-DRIVEN (fitCount,
// AOD-123) so a short cell never overflows: the count is the held lead, and at L the summary band is reserved
// above the rows.
//
// Due colour WARMS ONLY ON A BREACH (§5.2): Today → colors.text (bone-bright), future → colors.textMuted,
// overdue → colors.warning (amber, the one status ink; the sole hue this card spends — the summary never
// wears it). `formatDue` returns a three-way `tone` so overdue splits from Today at the draw site.
// (`+blocked` would need a server query change → out of v1 scope; overdue is the only breach — see AOD-134.)
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import { fitCount } from '../../../widgets/fitLadder';
import { PriorityGlyph } from './glyphs';
import { prioritySummary } from './soundings';

// The normalized payload the proxy delivers (integration-linear.md §4.1). This mirrors the server-side
// operations.ts `normalizeMyIssues` output: it is the data contract between the broker's normalize step
// and this renderer. The GraphQL query and the raw-response mapping stay server-side (§6.4), so the
// client re-declares only the shape it renders, never the query.
export interface MyIssue {
  id: string;
  identifier: string; // "AOD-53"
  title: string;
  url: string;
  stateName: string; // "In Progress"
  stateType: string; // a WorkflowState.type value
  priority: number; // 0 none, 1 urgent, 2 high, 3 medium, 4 low
  priorityLabel: string;
  dueDate: string | null;
}
export interface MyIssuesData {
  issues: MyIssue[];
  totalCount: number;
}

// The no-box fallback (a direct render / a test without a host box): how many ROWS a glance shows per size.
// The real hot path derives the count from the body HEIGHT (fitCount) so it never clips; these are the
// defensive floor. Rows are an M/L affordance (S/W lead with the summary, no rows), so S/W are 0.
const ROWS_BY_SIZE: Record<WidgetSize, number> = { S: 0, M: 4, W: 0, L: 4 };

// Row-fit chrome for the M/L issue rows (DP, conservative so it never under-counts height -> never clips): a
// single body-line row (glyph · identifier · title · due), the type.title count line as the held lead, and
// the "+N more" footer. At L the summary band is ADDED to the lead (see rowLead) so the rows never overlap it.
const ROW_FIT = { rowHeight: 22, footerHeight: 20 } as const;
const COUNT_LEAD = 24; // the §5.1 count line (type.title) reserved above everything

/** The count's muted qualifier, echoing the active filter (integration-linear.md §5.1; default 'open'). */
function filterQualifier(filter: unknown): string {
  switch (filter) {
    case 'in_progress':
      return 'in progress';
    case 'all':
      return 'assigned';
    case 'open':
    default:
      return 'open';
  }
}

/** The three-way due tone (design-linear.md §5.2): the row warms ONLY on a breach. Today is bone-bright,
 *  a future date recedes to muted, an overdue date is the amber breach ink. */
export type DueTone = 'today' | 'overdue' | 'future';

/**
 * Pure: a date-only dueDate ("YYYY-MM-DD") vs the device-local day -> the label + its tone (§5.2). Null when
 * absent or unparseable, so the row simply omits the due. Parsed as a LOCAL date (the day boundary is the
 * device's), like the calendar's all-day parsing. `tone` splits Today from overdue (both were the single
 * `emphasized: true` before Soundings) so overdue can warm to the amber status ink while Today stays bone.
 */
export function formatDue(ymd: string | null, now: Date): { label: string; tone: DueTone } | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(due.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((due.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays === 0) return { label: 'Today', tone: 'today' };
  const label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label, tone: diffDays < 0 ? 'overdue' : 'future' }; // overdue -> amber breach; future -> muted
}

/** Defensive read: a renderer must never crash on a partial payload (host shows an empty card instead). */
function asMyIssuesData(data: unknown): MyIssuesData {
  const d = data as Partial<MyIssuesData> | null | undefined;
  return {
    issues: Array.isArray(d?.issues) ? (d!.issues as MyIssue[]) : [],
    totalCount: typeof d?.totalCount === 'number' ? d!.totalCount : 0,
  };
}

/** AOD-125 emptiness predicate (WidgetDefinition.isEmpty): no assigned issues -> the host-drawn empty phase.
 *  The leaf no longer self-draws the empty body; the host owns it, so this card is reached only with issues. */
export function isMyIssuesEmpty(data: unknown): boolean {
  return asMyIssuesData(data).totalCount === 0;
}

export function MyIssuesCard({ data, config, size, box }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const { issues, totalCount } = asMyIssuesData(data);
  // AOD-125: the empty case (totalCount === 0) is the host-drawn `empty` phase, so the leaf is reached only
  // with issues to draw. It no longer self-draws the §5.1 EmptyBody.
  const qualifier = filterQualifier(config?.filter);
  const now = new Date();

  const showSummary = size === 'S' || size === 'W' || size === 'L'; // M is the reading size (rows carry priority)
  const showRows = size === 'M' || size === 'L';
  const isLarge = size === 'L';

  // The worded priority summary ("9 High · 1 Med"): the nonzero buckets, heavy→light. A tally of ALL loaded
  // issues (not capped like the rows), so at L it says something the visible rows can't. Legible on uniform
  // data because it is words, not repeated marks (the RETUNE fix for the retired silhouette).
  const summary = showSummary ? prioritySummary(issues) : [];

  // The visible ROW count is HEIGHT-DRIVEN (fitCount) so a short cell never overflows: the count is the held
  // lead, and at L the summary band is reserved above the rows (rowLead), so rows shed into "+N more" rather
  // than colliding with the summary. Falls back to the fixed per-size count on a direct render.
  const gap = theme.spacing(1.5);
  const rowLead = isLarge ? COUNT_LEAD + gap + theme.soundings.summaryBand : COUNT_LEAD;
  const visibleRowCount = showRows
    ? box
      ? fitCount(totalCount, box.height, { rowHeight: ROW_FIT.rowHeight, gap, leadHeight: rowLead, footerHeight: ROW_FIT.footerHeight })
      : (ROWS_BY_SIZE[size] ?? 4)
    : 0;
  const visibleRows = issues.slice(0, visibleRowCount);
  const remaining = totalCount - visibleRows.length;

  return (
    <View style={styles.body} accessibilityRole="summary" testID="linear-myissues">
      {/* §5.1 the assigned-count lead: the total bright, the filter qualifier muted. No accent (calm). */}
      <Text style={styles.count} numberOfLines={1} testID="linear-myissues-count">
        <Text style={styles.countNum}>{totalCount}</Text>
        <Text style={styles.countQual}> {qualifier}</Text>
      </Text>

      {/* The worded priority summary: "9 High · 1 Med", heavy→light, numerals bright + labels muted. Shown at
          S/W (no rows) and L (an all-issue tally above the rows). Monochrome — it never spends the amber. */}
      {showSummary && summary.length > 0 ? (
        <Text style={styles.summary} numberOfLines={1} testID="linear-myissues-summary">
          {summary.map((seg, i) => (
            <Text key={seg.priority} accessibilityLabel={`${seg.count} ${seg.label}`}>
              {i > 0 ? <Text style={styles.summarySep}> · </Text> : null}
              <Text style={styles.summaryNum}>{seg.count}</Text>
              <Text style={styles.summaryLabel}> {seg.label}</Text>
            </Text>
          ))}
        </Text>
      ) : null}

      {/* M/L issue rows: the per-row PriorityGlyph (bone / shape-only) · identifier · title (· due at L). The
          inline glyph is back after the RETUNE — a mark tied to its issue. Height-fit, shedding into "+N more". */}
      {showRows ? (
        <View style={styles.list}>
          {visibleRows.map((issue) => {
            const due = isLarge ? formatDue(issue.dueDate, now) : null;
            return (
              <View key={issue.id} style={styles.row}>
                <View style={styles.rowGlyph} testID="linear-myissues-rowglyph" accessibilityLabel={issue.priorityLabel}>
                  <PriorityGlyph
                    priority={issue.priority}
                    size={theme.priorityIcon.size}
                    onColor={theme.colors.text}
                    offColor={theme.colors.textMuted}
                    offOpacity={theme.priorityIcon.offOpacity}
                    knockoutColor={theme.colors.surface}
                  />
                </View>
                {/* The identifier is an L affordance: the narrow M column (1 unit) can't carry glyph · id ·
                    title without truncating the id itself, so M reads glyph · title (priority + what). */}
                {isLarge ? (
                  <Text style={styles.identifier} numberOfLines={1}>
                    {issue.identifier}
                  </Text>
                ) : null}
                <Text style={styles.title} numberOfLines={1}>
                  {issue.title}
                </Text>
                {due ? (
                  <Text
                    style={[styles.due, due.tone === 'today' && styles.dueToday, due.tone === 'overdue' && styles.dueOverdue]}
                    numberOfLines={1}
                    testID="linear-myissues-due"
                  >
                    {due.label}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {remaining > 0 && (
            <Text style={styles.more} testID="linear-myissues-more">
              +{remaining} more
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(1.5) },
  list: { gap: theme.spacing(1.5) },

  // §5.1 the count lead: the total in type.title (bright, tabular), the qualifier in type.meta (muted).
  count: { ...theme.type.title },
  countNum: { color: theme.colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countQual: { ...theme.type.meta, color: theme.colors.textMuted },

  // The worded priority summary: one line, type.meta. Numerals step up to bone-bright + tabular; the labels
  // and the middot separator recede to muted (the count/qualifier split, applied per bucket). No accent, no
  // amber — priority here is a word, not a status.
  summary: { ...theme.type.meta },
  summaryNum: { color: theme.colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryLabel: { color: theme.colors.textMuted },
  summarySep: { color: theme.colors.textMuted },

  // §5.2 the row: glyph (fixed slot) · identifier (muted tabular caption) · title (bright body, ellipsized) ·
  // due (L). The glyph slot is priorityIcon.size wide so the identifiers align down the column.
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  rowGlyph: { width: theme.priorityIcon.size, alignItems: 'center' },
  identifier: {
    ...theme.type.caption,
    letterSpacing: 0,
    fontWeight: '700',
    color: theme.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  title: { ...theme.type.body, color: theme.colors.text, flex: 1 },

  // due (L): future recedes to muted (the base); Today steps up to bone-bright; overdue warms to the amber
  // status ink (the one hue this card spends, and only on a breach, §5.2).
  due: { ...theme.type.caption, letterSpacing: 0, color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },
  dueToday: { color: theme.colors.text, fontWeight: '700' },
  dueOverdue: { color: theme.colors.warning, fontWeight: '700' },

  more: { ...theme.type.meta, color: theme.colors.textMuted, paddingTop: theme.spacing(0.5) },
}));
