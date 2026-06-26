// The "My Issues" leaf renderer (AOD-8 §6.1, integration-linear.md §4.1). Reached only on data-bearing
// lifecycle states (fresh / stale / error-with-data); the generic host draws every other state's chrome.
// It receives only { data, config, size } and never branches on auth, loading, or errors. Functional and
// on-brand-enough; the pixel polish is AOD-30.
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';

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

// How many rows fit a glance at each size; the rest collapse into a "+N more" footer (AOD-10 §5.1 roles).
const VISIBLE_BY_SIZE: Record<WidgetSize, number> = {
  small: 3,
  medium: 4,
  wide: 4,
  large: 7,
  tall: 10,
};

// priority 0..4 -> the dot style (integration-linear.md §4.1). Defensive default to "none".
const PRIORITY_DOT = ['dotNone', 'dotUrgent', 'dotHigh', 'dotMedium', 'dotLow'] as const;

/** Defensive read: a renderer must never crash on a partial payload (host shows an empty card instead). */
function asMyIssuesData(data: unknown): MyIssuesData {
  const d = data as Partial<MyIssuesData> | null | undefined;
  return {
    issues: Array.isArray(d?.issues) ? (d!.issues as MyIssue[]) : [],
    totalCount: typeof d?.totalCount === 'number' ? d!.totalCount : 0,
  };
}

export function MyIssuesCard({ data, size }: WidgetRenderProps) {
  const { issues, totalCount } = asMyIssuesData(data);
  const visible = issues.slice(0, VISIBLE_BY_SIZE[size] ?? 4);
  const remaining = totalCount - visible.length;

  if (totalCount === 0) {
    return (
      <View style={styles.empty} accessibilityRole="summary">
        <Text style={styles.emptyText} testID="linear-myissues-empty">
          No assigned issues
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list} accessibilityRole="summary" testID="linear-myissues">
      {visible.map((issue) => (
        <View key={issue.id} style={styles.row}>
          <View style={[styles.dot, styles[PRIORITY_DOT[issue.priority] ?? 'dotNone']]} />
          <Text style={styles.identifier} numberOfLines={1}>
            {issue.identifier}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {issue.title}
          </Text>
        </View>
      ))}
      {remaining > 0 && (
        <Text style={styles.more} testID="linear-myissues-more">
          +{remaining} more
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: {
    gap: theme.spacing(1.5),
  },
  empty: {
    paddingVertical: theme.spacing(2),
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotNone: { backgroundColor: theme.colors.border },
  dotUrgent: { backgroundColor: theme.colors.error },
  dotHigh: { backgroundColor: theme.colors.warning },
  dotMedium: { backgroundColor: theme.colors.accent },
  dotLow: { backgroundColor: theme.colors.textMuted },
  identifier: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  title: {
    color: theme.colors.text,
    fontSize: 14,
    flexShrink: 1,
  },
  more: {
    color: theme.colors.textMuted,
    fontSize: 12,
    paddingTop: theme.spacing(0.5),
  },
}));
