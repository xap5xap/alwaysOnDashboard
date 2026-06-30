// The "My Issues" leaf renderer (AOD-8 §6.1, integration-linear.md §4.1, design-linear.md §5). Reached
// only on data-bearing lifecycle states (fresh / stale / error-with-data); the generic host draws every
// other state's chrome. It receives only { data, config, size } and never branches on auth, loading, or
// errors.
//
// AOD-30 polish: the value-first issue list. The body LEADS with the assigned count (totalCount bright +
// a muted qualifier echoing the active filter: "12 open" / "12 in progress" / "12 assigned", §5.1), then
// the rows, then a "+N more" overflow. Each row is a single line: the priority GLYPH (carried by shape, not
// colour, §4), the identifier (muted tabular), and the title (bright, ellipsized); at large a due date sits
// on the right ("Today"/overdue bright, §5.2). The card deliberately spends NO blue accent: a dense work
// list reads calmest as neutral monochrome (§5.1). The density per size is medium 4 / large 7 / tall 10
// (the existing VISIBLE_BY_SIZE counts; small/wide are defensive, §8). An empty assigned set (totalCount
// === 0) is the §5.1 EmptyBody, not a host state. Ad-hoc font sizes map onto theme.type.* (§3/§9).
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import { EmptyBody } from '../../../widgets/EmptyBody';
import { CheckboxGlyph, PriorityGlyph } from './glyphs';

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

// How many rows fit a glance at each size; the rest collapse into a "+N more" footer (design-linear.md §5.2,
// the renderer's existing counts). small/wide are defensive (a reconciled off-aspect rect never reads an
// undefined count); neither is in My Issues' declared supportedSizes (§8).
const VISIBLE_BY_SIZE: Record<WidgetSize, number> = {
  small: 3,
  medium: 4,
  wide: 4,
  large: 7,
  tall: 10,
};

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

export function MyIssuesCard({ data, config, size }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const { issues, totalCount } = asMyIssuesData(data);

  if (totalCount === 0) {
    // §5.3 empty body: a calm "No assigned issues" with the per-widget checkbox glyph, no action (nothing
    // is wrong, the user simply has nothing assigned). Wrapped to keep the existing *-empty testID contract.
    return (
      <View style={styles.fill} testID="linear-myissues-empty">
        <EmptyBody
          line="No assigned issues"
          subline="You're all caught up"
          glyph={<CheckboxGlyph color={theme.colors.accent} />}
        />
      </View>
    );
  }

  const visible = issues.slice(0, VISIBLE_BY_SIZE[size] ?? 4);
  const remaining = totalCount - visible.length;
  const qualifier = filterQualifier(config?.filter);
  const isLarge = size === 'large';
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
  fill: { flex: 1 },
  body: { gap: theme.spacing(2) },
  list: { gap: theme.spacing(1.5) },

  // §5.1 the count lead: the total in type.title (bright, tabular), the qualifier in type.meta (muted).
  count: { ...theme.type.title },
  countNum: { color: theme.colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  countQual: { ...theme.type.meta, color: theme.colors.textMuted },

  // §5.2 the row: glyph · identifier (muted tabular caption) · title (bright body, ellipsized) · due (large).
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

  // due: a quiet muted meta at large; "Today"/overdue step up to bright text (§5.2).
  due: { ...theme.type.caption, letterSpacing: 0, color: theme.colors.textMuted, fontVariant: ['tabular-nums'] },
  dueEmph: { color: theme.colors.text, fontWeight: '700' },

  more: { ...theme.type.meta, color: theme.colors.textMuted, paddingTop: theme.spacing(0.5) },
}));
