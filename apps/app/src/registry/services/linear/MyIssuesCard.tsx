// The "My Issues" leaf renderer (AOD-8 §6.1, integration-linear.md §4.1, design-linear.md §5). Reached
// only on data-bearing lifecycle states (fresh / stale / error-with-data); the generic host draws every
// other state's chrome. It receives only { data, config, size } and never branches on auth, loading, or
// errors.
//
// AOD-30 polish: the value-first issue list. The body LEADS with the assigned count (totalCount bright +
// a muted qualifier echoing the active filter: "12 open" / "12 in progress" / "12 assigned", §5.1), then
// the rows, then a "+N more" overflow. Each row is a single line: the priority GLYPH (carried by shape, not
// colour, §4), the identifier (muted tabular), and the title (bright, ellipsized); at L a due date sits
// on the right ("Today"/overdue bright, §5.2). The card deliberately spends NO blue accent: a dense work
// list reads calmest as neutral monochrome (§5.1). The density per slot is W 4 / L 7 / M 10 (the pre-slot
// medium/large/tall counts, AOD-122; S is defensive, §8). An empty assigned set (totalCount === 0) is now
// the host-drawn `empty` lifecycle phase (AOD-125, isMyIssuesEmpty), not a leaf-drawn body. Ad-hoc font
// sizes map onto theme.type.* (§3/§9).
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import { fitCount } from '../../../widgets/fitLadder';
import { PriorityGlyph } from './glyphs';

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

// The pre-AOD-123 fixed per-size counts. Kept only as the fallback when the host does not pass a box
// (a direct render). AOD-123 replaces them with a HEIGHT-DRIVEN count (fitCount) so a short cell never
// overflows: the old fixed 4-at-W stacked ~128px of count + rows into a 48px body and clipped. The count
// line is the §5.1 value lead and always shows; the rows shed into "+N more" by how many actually fit.
const VISIBLE_BY_SIZE: Record<WidgetSize, number> = {
  S: 3,
  M: 10,
  W: 4,
  L: 7,
};

// Row-fit chrome for My Issues (DP, conservative so it never under-counts height -> never clips): a single
// body-line row (glyph · id · title), the type.title count line as the lead, and the "+N more" footer.
const ROW_FIT = { rowHeight: 22, leadHeight: 24, footerHeight: 20 } as const;

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

/**
 * Pure: a date-only dueDate ("YYYY-MM-DD") vs the device-local day -> the label + whether it is emphasised
 * (design-linear.md §5.2: "Today" and overdue step up to colors.text; future dates stay muted). Null when
 * absent or unparseable, so the row simply omits the due. Parsed as a LOCAL date (the day boundary is the
 * device's), like the calendar's all-day parsing.
 */
export function formatDue(ymd: string | null, now: Date): { label: string; emphasized: boolean } | null {
  if (!ymd) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(due.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((due.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays === 0) return { label: 'Today', emphasized: true };
  const label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { label, emphasized: diffDays < 0 }; // overdue -> bright; future -> muted
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
  // AOD-125: the empty case (totalCount === 0) is now the host-drawn `empty` phase (isMyIssuesEmpty), so the
  // leaf is reached only with issues to draw. It no longer self-draws the §5.1 EmptyBody.

  // AOD-123: the visible-row count is HEIGHT-DRIVEN so a short cell never overflows — the rows shed into
  // "+N more" by what actually fits the host-passed box (the count line reserved as the lead). Falls back
  // to the fixed per-size count only on a direct render with no box.
  const visibleCount = box
    ? fitCount(totalCount, box.height, { ...ROW_FIT, gap: theme.spacing(1.5) })
    : (VISIBLE_BY_SIZE[size] ?? 4);
  const visible = issues.slice(0, visibleCount);
  const remaining = totalCount - visible.length;
  const qualifier = filterQualifier(config?.filter);
  const isLarge = size === 'L'; // AOD-122 slot id (was 'large'; same 2x2 geometry)
  const now = new Date();

  return (
    <View style={styles.body} accessibilityRole="summary" testID="linear-myissues">
      {/* §5.1 the assigned-count lead: the total bright, the filter qualifier muted. No accent (calm). */}
      <Text style={styles.count} numberOfLines={1} testID="linear-myissues-count">
        <Text style={styles.countNum}>{totalCount}</Text>
        <Text style={styles.countQual}> {qualifier}</Text>
      </Text>

      <View style={styles.list}>
        {visible.map((issue) => {
          const due = isLarge ? formatDue(issue.dueDate, now) : null;
          return (
            <View key={issue.id} style={styles.row}>
              {/* The priority glyph carries level by shape; the label rides an a11y wrapper (the shape is
                  invisible to a screen reader). */}
              <View style={styles.glyphCol} accessibilityLabel={issue.priorityLabel}>
                <PriorityGlyph
                  priority={issue.priority}
                  size={theme.priorityIcon.size}
                  onColor={theme.colors.text}
                  offColor={theme.colors.textMuted}
                  offOpacity={theme.priorityIcon.offOpacity}
                  knockoutColor={theme.colors.surface}
                />
              </View>
              <Text style={styles.identifier} numberOfLines={1}>
                {issue.identifier}
              </Text>
              <Text style={styles.title} numberOfLines={1}>
                {issue.title}
              </Text>
              {due ? (
                <Text
                  style={[styles.due, due.emphasized && styles.dueEmph]}
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
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: { gap: theme.spacing(2) },
  list: { gap: theme.spacing(1.5) },

  // §5.1 the count lead: the total in type.title (bright, tabular), the qualifier in type.meta (muted).
  count: { ...theme.type.title },
  countNum: { color: theme.colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countQual: { ...theme.type.meta, color: theme.colors.textMuted },

  // §5.2 the row: glyph · identifier (muted tabular caption) · title (bright body, ellipsized) · due (L).
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  glyphCol: { width: theme.priorityIcon.size, alignItems: 'center' },
  identifier: {
    ...theme.type.caption,
    letterSpacing: 0,
    fontWeight: '700',
    color: theme.colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  title: { ...theme.type.body, color: theme.colors.text, flex: 1 },

  // due: a quiet muted meta at L; "Today"/overdue step up to bright text (§5.2).
  due: { ...theme.type.caption, letterSpacing: 0, color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },
  dueEmph: { color: theme.colors.text, fontWeight: '700' },

  more: { ...theme.type.meta, color: theme.colors.textMuted, paddingTop: theme.spacing(0.5) },
}));
