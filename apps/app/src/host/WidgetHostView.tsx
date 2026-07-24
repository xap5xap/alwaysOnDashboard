// The generic widget host chrome (AOD-8 §6.1, AOD-10 §7.3, design-widget-system.md §4-§7). Pure and
// presentational: given a WidgetViewState it draws the shared card frame, the per-widget caption header
// (AOD-124), the status-and-refresh cluster, and one visual per lifecycle state, and on data-bearing
// states (live / stale / error-with-data) it mounts the widget's own renderer with { data, config, size }
// and overlays staleness/error chrome. It branches on the view state, never on which service. The day/night
// dim overlay (§7) and the night-frame for an opt-out widget (dimsWithAmbient: false, §7.2) ride the
// ambient signal; the refresh control (§6) and the caption strategy (AOD-124, resolved to null = a
// headerless card) are host capabilities keyed on generic widget properties, not on a service name.
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetDefinition, WidgetSize } from '../registry/types';
import { invokesRenderer, type WidgetViewState } from '../widgets/lifecycle';
import { useAmbient } from '../ambient/AmbientContext';
import { EmptyBody } from '../widgets/EmptyBody';
import { LinkGlyph, RingGlyph, SlidersGlyph } from '../widgets/glyphs';
import { RefreshControl, type RefreshControlState } from './RefreshControl';
import { SIZE_CATALOGUE } from '../widgets/sizes';
import { UNIT_PX } from '../layout/geometry';
import { bodyBox } from '../widgets/fitLadder';
import { DEFAULT_CAPTION_STRATEGY, resolveCaption } from '../widgets/caption';

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
  /** AOD-211: this card is the long-press quick-actions menu's target. When true the card BRIGHTENS ITS OWN
   *  border (quickMenu.liftBorder → textMuted), the aligned-by-construction "this is the one you grabbed"
   *  highlight — on the card's real border, not an overlay ring around its slot (design-quick-actions-menu §4). */
  focused?: boolean;
}

function dataOf(state: WidgetViewState): unknown {
  // AOD-125: live/stale/empty all carry data (empty carries the fetched-but-empty payload, so a data-derived
  // caption still resolves); error may carry last-known data. Everything else (connecting/ghost/prompts) has none.
  if (state.phase === 'live' || state.phase === 'stale' || state.phase === 'empty') return state.data;
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

/** The shared action-bearing prompt (§5): a centred glyph over a muted line over one accent action. Drives
 *  the needs_config / disconnected / data-less error states. The host-drawn `empty` and `ghost` placeholders
 *  (AOD-125) look similar but carry NO action — nothing is wrong, so there is nothing to act on. */
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
  focused = false,
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

  // AOD-124 §4.2: the per-widget caption. The host resolves the leaf's declared strategy (default
  // SERVICE · WIDGET) from { size, config, data, serviceName, title } to a header string, or `null` for a
  // HEADERLESS card (chromeless `hidden`, or a size-suppressed `place`/`calendar` at S). Generic — it
  // branches on the strategy, never on a service; the pure resolver lives in widgets/caption.ts.
  const caption = resolveCaption({
    strategy: def.caption ?? DEFAULT_CAPTION_STRATEGY,
    size,
    title: def.title,
    serviceName,
    config,
    data: dataOf(state),
  });
  const suppressHeader = caption == null;

  // AOD-123: the body px box (DP) the leaf's FitBody fits content into. Derived from the slot rect —
  // UNIT_PX * nominal units — minus the card padding on both axes and, when the header shows, the header
  // row + the header->body gap. Keyed off the RESOLVED caption (null → no header → full-height body).
  // Computed here (host), passed down: no leaf measures on the hot path. DP, not screen px (the AOD-81
  // lesson: the kiosk wall auto-fits on top, so the body must be DP-correct).
  const cat = SIZE_CATALOGUE[size];
  const bodyPxBox = bodyBox(cat.nominalW, cat.nominalH, UNIT_PX, {
    headerShown: !suppressHeader,
    padding: theme.spacing(3),
    headerHeight: theme.type.caption.lineHeight ?? 16, // the caption row == the RefreshControl box (16)
    headerGap: theme.spacing(2),
  });

  const showStaleDot = state.phase === 'stale';
  const showErrorDot = state.phase === 'error' && showData;
  const hasStatusCluster = showStaleDot || showErrorDot || !!refresh;

  // The stale/error mark + the on-demand refresh control. It sits in the header when a caption shows; on a
  // headerless card it floats to the top-trailing corner (see below), so the SAME cluster serves both.
  const statusCluster = (
    <>
      {showStaleDot && <View style={[styles.dot, styles.dotWarning]} testID="widget-stale-dot" />}
      {showErrorDot && <View style={[styles.dot, styles.dotError]} testID="widget-error-dot" />}
      {refresh ? <RefreshControl state={refresh.state} onPress={refresh.onPress} /> : null}
    </>
  );

  return (
    <View
      style={[styles.card, state.phase === 'ghost' && styles.cardGhost, nightFrame && styles.cardNight, focused && styles.cardFocused]}
      testID="widget-card"
    >
      {!suppressHeader && (
        <View style={styles.header} testID="widget-header">
          <Text style={[styles.title, nightFrame && styles.titleNight]} numberOfLines={1}>
            {caption}
          </Text>
          <View style={styles.cluster}>{statusCluster}</View>
        </View>
      )}

      <View style={styles.body}>
        {/* AOD-125 `connecting` (Many Skies §1c): the first-fetch skeleton, shimmering in skeleton greys —
            "skeletons only where nothing has ever lived" (Holding Course). Renamed from the AOD-10 `loading`. */}
        {state.phase === 'connecting' && (
          <View style={styles.skeleton} testID="widget-connecting" accessibilityLabel="Connecting">
            <View style={[styles.bar, styles.barHeader]} />
            <View style={[styles.bar, styles.barValue]} />
            <View style={[styles.bar, styles.barMetaWide]} />
            <View style={[styles.bar, styles.barMetaNarrow]} />
          </View>
        )}

        {/* AOD-125 `ghost` (Many Skies §1c "GHOST"): the not-yet-lit tile. A dim, transparent placeholder
            (the cardGhost frame above), NOT a card pretending to be lit and NOT the skeleton's busy shimmer.
            Action-less by design: unlike `disconnected`, a ghost is initializing and will light on its own
            (the user-action "Connect" case is the disconnected action-state). See the lifecycle DESIGN FLAG. */}
        {state.phase === 'ghost' && (
          <View style={styles.ghost} testID="widget-ghost" accessibilityLabel="Not yet lit">
            <View style={styles.ghostGlyph}>
              <RingGlyph color={theme.colors.textMuted} />
            </View>
            <Text style={styles.ghostLine}>Not yet lit</Text>
          </View>
        )}

        {/* AOD-125 `empty` (Many Skies §1c "EMPTY — PLAIN WORDS"): a data-bearing fetch whose content is
            legitimately empty, promoted from the leaf-drawn EmptyBody to a host-drawn phase. Plain words, no
            action (nothing is wrong; the data simply says "nothing"). AOD-136: a widget may name its own
            plain words via def.emptyCopy (Calendar: "Nothing next" / "Nothing left today"); absent, the host
            falls back to the generic line, so a widget without emptyCopy keeps the shared "Nothing right now." */}
        {state.phase === 'empty' && (
          <EmptyBody
            line={def.emptyCopy?.line ?? 'Nothing right now.'}
            subline={def.emptyCopy?.subline}
          />
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

      {/* AOD-124 §3: on a HEADERLESS card (chromeless `hidden`, or a size-suppressed caption at S) the
          stale/error mark + refresh have no header row to sit in, so they float to the top-trailing
          corner. Rendered AFTER the body so it paints on top; absolute, so it never changes the AOD-123
          body box (the 72×72 S invariant holds). Placement is design-silent — interpreted as a card badge
          per Holding Course's "a card badge for one card's trouble". A never-fetching card (Clock) has no
          dot and no refresh, so nothing shows. */}
      {suppressHeader && hasStatusCluster && (
        <View style={[styles.cluster, styles.cornerCluster]} testID="widget-corner-status">
          {statusCluster}
        </View>
      )}

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
    // AOD-203: no minWidth floor. A w=1 footprint is UNIT_PX (96 DP) wide, so a 160 DP floor forced the
    // card 1.67x past its column and overflowed the neighbour (on the handheld canvas AND the wall). Since
    // AOD-123 the leaf fits its own content to the host-passed box (value held, detail truncate-then-drop),
    // so no width floor is needed: the card fills its footprint and never exceeds it. overflow:hidden stays
    // to defend the prompts and clip the dim overlay's rounded corners.
    overflow: 'hidden',
  },
  cardNight: {
    backgroundColor: theme.night.surface,
    borderColor: theme.night.border,
  },
  // AOD-211: the quick-actions menu target brightens its OWN border to quickMenu.liftBorder (textMuted) — the
  // aligned "this is the one you grabbed" highlight. Applied last so it wins over the resting / night border.
  cardFocused: {
    borderColor: theme.colors.textMuted,
  },
  // AOD-125 the ghost frame (Many Skies §1c): "transparent — an invitation, not a card pretending to be
  // lit". No surface fill and a dashed hairline read as an empty, not-yet-lit slot; the whole tile sits at
  // reduced opacity so it recedes into the night sky. Reuses existing tokens only (no new colour).
  cardGhost: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    opacity: 0.6,
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
  // AOD-124 §3: the headerless status cluster's corner berth. Absolute (out of flow, so it never resizes
  // the AOD-123 body box), tucked at the top-trailing corner inside the card padding.
  cornerCluster: {
    position: 'absolute',
    top: theme.spacing(2),
    right: theme.spacing(2),
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
  // AOD-125 the ghost placeholder body: centred, calm, action-less — a faint mark over quiet plain words.
  // The muted (not accent) glyph keeps it inert, so it never reads as a lit card (Many Skies §1c).
  ghost: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1.5),
    paddingVertical: theme.spacing(2),
  },
  ghostGlyph: {
    marginBottom: theme.spacing(0.5),
  },
  ghostLine: {
    ...theme.type.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
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
