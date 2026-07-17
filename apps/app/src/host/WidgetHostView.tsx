// The generic widget host chrome (AOD-8 §6.1, AOD-10 §7.3, design-widget-system.md §4-§7). Pure and
// presentational: given a WidgetViewState it draws the shared card frame, the quiet SERVICE · WIDGET
// header, the status-and-refresh cluster, and one visual per lifecycle state, and on data-bearing states
// (fresh / stale / error-with-data) it mounts the widget's own renderer with { data, config, size } and
// overlays staleness/error chrome. It branches on the view state, never on which service. The day/night
// dim overlay (§7) and the night-frame for an opt-out widget (dimsWithAmbient: false, §7.2) ride the
// ambient signal; the refresh control (§6) and header suppression (§4.2) are host capabilities keyed on
// generic widget properties, not on a service name.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetDefinition, WidgetSize } from '../registry/types';
import { invokesRenderer, type WidgetViewState } from '../widgets/lifecycle';
import { useAmbient } from '../ambient/AmbientContext';
import { LinkGlyph, SlidersGlyph } from '../widgets/glyphs';
import { RefreshControl, type RefreshControlState } from './RefreshControl';
import { SIZE_CATALOGUE } from '../widgets/sizes';
import { UNIT_PX } from '../layout/geometry';
import { bodyBox } from '../widgets/fitLadder';

export interface WidgetHostViewProps {
  state: WidgetViewState;
  def: WidgetDefinition;
  size: WidgetSize;
  config: Record<string, unknown>;
  serviceName: string;
  onReconnect?: () => void;
  onReconfigure?: () => void;
  onRetry?: () => void;
  /** The AOD-15 refresh control (§6). Present only for a fetching widget; omitted hides it (Clock). */
  refresh?: { state: RefreshControlState; onPress: () => void };
  /** For the "updated Nm ago" staleness caption (§5). Defaults to Date.now. */
  now?: () => number;
}

function dataOf(state: WidgetViewState): unknown {
  if (state.phase === 'fresh' || state.phase === 'stale') return state.data;
  if (state.phase === 'error') return state.data;
  return undefined;
}

/** A glanceable "updated Nm ago" for the staleness caption (§5). */
function updatedAgo(fetchedAt: number, now: number): string {
  const s = Math.max(0, Math.floor((now - fetchedAt) / 1000));
  if (s < 60) return 'updated just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `updated ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `updated ${h}h ago`;
  return `updated ${Math.floor(h / 24)}d ago`;
}

/** The shared action-bearing prompt (§5): a centred glyph over a muted line over one accent action. The
 *  empty body (§5.1) deliberately looks similar but carries NO action; this is the host-drawn cousin. */
function Prompt({
  glyph,
  line,
  actionLabel,
  onAction,
  testID,
}: {
  glyph?: React.ReactNode;
  line: string;
  actionLabel: string;
  onAction?: () => void;
  testID: string;
}) {
  return (
    <View style={styles.prompt} testID={testID}>
      {glyph ? <View style={styles.promptGlyph}>{glyph}</View> : null}
      <Text style={styles.promptLine}>{line}</Text>
      {onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function WidgetHostView({
  state,
  def,
  size,
  config,
  serviceName,
  onReconnect,
  onReconfigure,
  onRetry,
  refresh,
  now = Date.now,
}: WidgetHostViewProps) {
  const { theme } = useUnistyles();
  const ambient = useAmbient();
  const Renderer = def.render;
  const showData = invokesRenderer(state);

  // §7.2 opt-out: a dimsWithAmbient:false widget skips the global overlay and gets a night frame at
  // phase 'night' (the Clock recolours its own text via useAmbient()). Everything else dims uniformly.
  const optOut = def.dimsWithAmbient === false;
  const nightFrame = optOut && ambient.phase === 'night';
  const overlayOpacity = optOut ? 0 : ambient.dimLevel * theme.overlay.maxDim;

  // §4.2 the header is suppressible for a self-evident card (Clock S declares it). Generic per the
  // widget's hideHeaderAtSizes, not a Clock special case.
  const suppressHeader = !!def.hideHeaderAtSizes?.includes(size);

  // AOD-123: the body px box (DP) the leaf's FitBody fits content into. Derived from the slot rect —
  // UNIT_PX * nominal units — minus the card padding on both axes and, when the header shows, the header
  // row + the header->body gap. Computed here (host), passed down: no leaf measures on the hot path. DP,
  // not screen px (the AOD-81 lesson: the kiosk wall auto-fits on top, so the body must be DP-correct).
  const cat = SIZE_CATALOGUE[size];
  const bodyPxBox = bodyBox(cat.nominalW, cat.nominalH, UNIT_PX, {
    headerShown: !suppressHeader,
    padding: theme.spacing(3),
    headerHeight: theme.type.caption.lineHeight ?? 16, // the caption row == the RefreshControl box (16)
    headerGap: theme.spacing(2),
  });

  // §4.2 SERVICE · WIDGET, collapsed to one token when the widget title is the service name (Clock).
  const headerTitle =
    def.title.toLowerCase() === serviceName.toLowerCase() ? serviceName : `${serviceName} · ${def.title}`;

  const showStaleDot = state.phase === 'stale';
  const showErrorDot = state.phase === 'error' && showData;

  return (
    <View style={[styles.card, nightFrame && styles.cardNight]} testID="widget-card">
      {!suppressHeader && (
        <View style={styles.header} testID="widget-header">
          <Text style={[styles.title, nightFrame && styles.titleNight]} numberOfLines={1}>
            {headerTitle}
          </Text>
          <View style={styles.cluster}>
            {showStaleDot && <View style={[styles.dot, styles.dotWarning]} testID="widget-stale-dot" />}
            {showErrorDot && <View style={[styles.dot, styles.dotError]} testID="widget-error-dot" />}
            {refresh ? <RefreshControl state={refresh.state} onPress={refresh.onPress} /> : null}
          </View>
        </View>
      )}

      <View style={styles.body}>
        {state.phase === 'loading' && (
          <View style={styles.skeleton} testID="widget-loading" accessibilityLabel="Loading">
            <View style={[styles.bar, styles.barHeader]} />
            <View style={[styles.bar, styles.barValue]} />
            <View style={[styles.bar, styles.barMetaWide]} />
            <View style={[styles.bar, styles.barMetaNarrow]} />
          </View>
        )}

        {showData && <Renderer data={dataOf(state)} config={config} size={size} box={bodyPxBox} />}

        {/* §5 host staleness / error captions appended under the last good render. */}
        {state.phase === 'stale' && state.fetchedAt != null && (
          <Text style={[styles.statusCaption, styles.captionWarning]} testID="widget-stale-caption">
            {updatedAgo(state.fetchedAt, now())}
          </Text>
        )}
        {state.phase === 'error' && showData && (
          <Text style={[styles.statusCaption, styles.captionError]} testID="widget-error-caption">
            {'couldn’t refresh'}
          </Text>
        )}

        {state.phase === 'error' && !showData && (
          <Prompt
            line="Couldn't load"
            actionLabel="Retry"
            onAction={onRetry}
            testID="widget-error"
          />
        )}

        {state.phase === 'needs_config' && (
          <Prompt
            glyph={<SlidersGlyph color={theme.colors.textMuted} knobFill={theme.colors.surface} />}
            line="Reconfigure this widget"
            actionLabel="Reconfigure"
            onAction={onReconfigure}
            testID="widget-needs-config"
          />
        )}

        {state.phase === 'disconnected' && (
          <Prompt
            glyph={<LinkGlyph color={theme.colors.textMuted} />}
            line={`Connect ${serviceName} to use this`}
            actionLabel="Connect"
            onAction={onReconnect}
            testID="widget-disconnected"
          />
        )}
      </View>

      {/* §7.1 global dim overlay: opacity dimLevel * overlay.maxDim, skipped for an opt-out widget. */}
      {overlayOpacity > 0 && (
        <View
          style={[styles.overlay, { opacity: overlayOpacity }]}
          pointerEvents="none"
          testID="widget-dim-overlay"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing(3),
    gap: theme.spacing(2),
    minWidth: 160,
    // AOD-123: with the shared FitBody, this is now a BACKSTOP, not the primary fit. A migrated leaf fits
    // its own content to the host-passed box (value held, detail truncate-then-drop), so it no longer
    // relies on this clip; it stays to defend not-yet-migrated leaves, the prompts, and the dim overlay's
    // rounded corners. The bare-clip-as-fit that AOD-95/97 complained about is gone for migrated cards.
    overflow: 'hidden',
  },
  cardNight: {
    backgroundColor: theme.night.surface,
    borderColor: theme.night.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  title: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  titleNight: {
    color: theme.night.secondary,
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  dot: {
    width: theme.dot.r * 2,
    height: theme.dot.r * 2,
    borderRadius: theme.dot.r,
  },
  dotWarning: {
    backgroundColor: theme.colors.warning,
  },
  dotError: {
    backgroundColor: theme.colors.error,
  },
  body: {
    gap: theme.spacing(2),
  },
  skeleton: {
    gap: theme.spacing(2),
    paddingVertical: theme.spacing(1),
  },
  bar: {
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.skeleton,
  },
  barHeader: {
    height: 11,
    width: '52%',
  },
  barValue: {
    height: 30,
    width: '62%',
  },
  barMetaWide: {
    height: 10,
    width: '74%',
  },
  barMetaNarrow: {
    height: 10,
    width: '46%',
  },
  statusCaption: {
    ...theme.type.caption,
    letterSpacing: 0,
  },
  captionWarning: {
    color: theme.colors.warning,
  },
  captionError: {
    color: theme.colors.error,
  },
  prompt: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1.5),
    paddingVertical: theme.spacing(2),
  },
  promptGlyph: {
    marginBottom: theme.spacing(0.5),
  },
  promptLine: {
    ...theme.type.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  action: {
    ...theme.type.label,
    color: theme.colors.accent,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.overlay.color,
    borderRadius: theme.radius.md,
  },
}));
