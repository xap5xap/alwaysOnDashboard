// The Add-by-Seeing gallery (AOD-147; claude-design/"Vela - Many Skies - v2" §2 "Add by Seeing" + §2a
// "Take A — the shelf under the sky"). It REPLACES the plain WidgetPicker list (AOD-8 §9 invariant 2, AOD-27
// §6): instead of a sentence per widget, you SEE the card at real size on a shelf AND, on focus, previewed on
// your OWN sky before it lands. It names no service: it reads the registry + the live connection map and the
// current sky, and renders whatever the registry publishes, so adding an integration grows this gallery by one
// tile with zero edits here (the AOD-8 §10 seam). Opened from the same triggers as the old picker (Dashboard
// `picking` / an empty page's "Add a card").
//
// The seam, precisely (the load-bearing invariant of this issue):
//   - The catalog is `registry.addableWidgets(connected)` (connected/none-class widgets) UNIONED with the rest
//     of the registry's widgets as GHOST tiles (unconnected services — "see everything, connect what you
//     want"). Both are derived from the registry alone; there is NO per-service branch anywhere below.
//   - Every tile renders the widget's OWN card via the generic host view (WidgetHostView), and the on-sky
//     preview is the REAL card (the live WidgetHost). Neither names a service; both branch only on the generic
//     lifecycle/auth-class taxonomy the host already uses.
//
// Take A layout (top → bottom in the sheet): the current active sky rendered read-only + SCALED BACK A STEP (a
// light silhouette of your cards — the AOD-145 approach the runbook allows, "judge the room, not the
// furniture"), with the focused widget dropped onto it as a RINGED live preview at its firstFreeSlot landing
// (the exact rect useAddWidget will use); a search field; then a horizontal SHELF of tiles. Focusing a tile
// (tap; device auto-center-on-scroll is AOD-190) previews it above. Add lands it and — "Add never leaves
// Arrange" — the gallery STAYS for the next card. A required-no-default widget still routes through the config
// form first (configure-on-add, AOD-10 §4). A ghost tile's action is the current connect-via-Settings path
// (the in-place ghost-connect is AOD-149, deferred).
//
// AOD-148 (size-by-seeing + already-added, resolves AOD-102) adds two generic marks over the AOD-147 shelf,
// both derived from the registry + the current sky, never per-service:
//   - A tile whose widget already sits on THIS sky (matched on serviceId + widgetType against the live
//     instances) wears a quiet "• ON THIS SKY" mark and its action becomes "Add again" — a duplicate stays
//     possible, never silent (§2 "Added is visible").
//   - The FOCUSED tile carries an S/M/W/L selector of the widget's supportedSizes. The selected size drives
//     BOTH the tile's own face AND the on-sky preview (the previewInstance rect/size), so they flip together
//     (§2 "Size is chosen by seeing … the card lands exactly as shown"); Add then lands the card at that size
//     via useAddWidget's optional size override. The selection resets to the default on focusing a new widget.
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, UnistylesRuntime, useUnistyles } from 'react-native-unistyles';
import { connectedServiceIds } from '../connections/connectionsRepo';
import { useConnections } from '../connections/useConnections';
import { WidgetHost } from '../host/WidgetHost';
import { WidgetHostView } from '../host/WidgetHostView';
import { useRegistry } from '../registry/RegistryProvider';
import type {
  AuthClass,
  ServiceDefinition,
  WidgetDefinition,
  WidgetInstance,
  WidgetSize,
} from '../registry/types';
import { GRID_COLUMNS, type Orientation } from '../widgets/sizes';
import { ResolvedConfigFormModal } from '../widgets/ResolvedConfigFormModal';
import { Button, Input, Segmented, Sheet, type SegmentedOption } from '../ui';
import { UNIT_PX } from './geometry';
import { slotToPixels } from './grid';
import { defaultConfig, defaultPlacementRect, defaultPlacementSize, requiresConfiguration } from './placement';
import { useAddWidget } from './useAddWidget';
import { useDashboard } from './useDashboard';

export interface AddGalleryProps {
  onClose(): void;
  /** AOD-197 (S4): the active orientation's fit-to-width cell size (cellPx) + column count, from Dashboard —
   *  the SAME values the arrange canvas uses. The on-sky preview re-bases its silhouette on them so the
   *  preview box fits the sheet width (it no longer widens with the fixed grid as the column count grew from 2
   *  to 6). Absent (tests / a caller without them) falls back to the nominal UNIT_PX + landscape GRID_COLUMNS. */
  cellPx?: number;
  columns?: number;
  /** AOD-197 (Pass B2): the active device orientation, from Dashboard. Threaded to useAddWidget (so the add
   *  reads + writes the active orientation's cache and places on its column grid) and to useDashboard (so the
   *  silhouette + firstFreeSlot preview read the SAME per-orientation cache the add mutates). Absent (tests /
   *  a caller without it) falls back to 'landscape', keeping the no-arg path byte-identical. */
  orientation?: Orientation;
}

// The scaled-sky region (DP). SKY_MAX_CELL is a "step back" from the real UNIT_PX (96) — the same zoom-out
// language as page altitude, so the whole sky reads at once; a taller sky shrinks further to fit SKY_H. Device
// proportion / auto-center feel is AOD-190; these are the tunable seeds.
const SKY_H = 236;
const SKY_MAX_CELL = 60; // ~0.63 * UNIT_PX
const SILHOUETTE_GAP = 4; // the inset that reads placed cards as distinct blocks (mirrors SkyThumbnail)

// A shelf tile is a fixed, legible card box (>= the widget card's own min width so its face never clips). The
// design's proportion-sized tiles ("a wide card is wide") ride with the S/M/W/L selector in AOD-148.
const TILE_W = 176;
const TILE_H = 150;

/** The generic "price" a ghost states, by AUTH CLASS — never by service (the same taxonomy WidgetHost branches
 *  on for platform_key/none). oauth2 → a sign-in, *_key → a key, platform_key → a location. */
function connectPrice(authClass: AuthClass): string {
  switch (authClass) {
    case 'oauth2':
      return 'a sign-in';
    case 'api_key':
      return 'an API key';
    case 'admin_key':
      return 'an admin key';
    case 'platform_key':
      return 'a location';
    case 'none':
    default:
      return '';
  }
}

interface Tile {
  def: WidgetDefinition;
  service: ServiceDefinition;
  addable: boolean; // its parent service is connected (or it is a none-class widget like Clock)
}

/** A stable service:type key for the addable-set membership test (never rendered). */
function widgetKey(serviceId: string, type: string): string {
  return `${serviceId}:${type}`;
}

// The size-by-seeing selector's canonical S·M·W·L order (Many Skies §1c/§2). A widget's `supportedSizes` may
// declare any subset in any order; the selector always reads S → M → W → L, filtered to what the widget
// supports, so the row is stable across widgets. Generic: it names no service.
const SIZE_ORDER: readonly WidgetSize[] = ['S', 'M', 'W', 'L'];
function sizeOptions(supported: WidgetSize[]): SegmentedOption<WidgetSize>[] {
  return SIZE_ORDER.filter((s) => supported.includes(s)).map((s) => ({ label: s, value: s }));
}

export function AddGallery({
  onClose,
  cellPx = UNIT_PX,
  columns = GRID_COLUMNS,
  orientation = 'landscape',
}: AddGalleryProps) {
  const registry = useRegistry();
  const { connections, isLoading, isError } = useConnections();
  const { addWidget, pending, error } = useAddWidget(orientation);
  // The active sky, read reactively from the same cache useAddWidget writes into (AOD-197: the ACTIVE
  // orientation's cache), so the silhouette + the firstFreeSlot preview track an add (a provisional appears
  // immediately). Registry-free: it is just geometry.
  const { instances } = useDashboard(orientation);

  const [search, setSearch] = useState('');
  // The focused (centered) widget → its live preview on the sky. Null = browsing: the sky shows exactly what
  // you have (§2a). Only an ADDABLE widget focuses (a ghost has no live card; its action is Connect).
  const [focused, setFocused] = useState<{ serviceId: string; type: string } | null>(null);
  // AOD-148 size-by-seeing: the size the focused widget previews + lands at. Reset to the focused widget's
  // default whenever focus moves to a DIFFERENT widget (focusTile), so a pick never leaks across widgets.
  const [selectedSize, setSelectedSize] = useState<WidgetSize | null>(null);
  // configure-on-add: a required-no-default widget routes through the config form before insert (AOD-10 §4);
  // everything else adds with schema defaults (AOD-51). Carries the selected size so it still applies on
  // submit (AOD-148 — the size chosen before the form opened lands with the configured card).
  const [configuring, setConfiguring] = useState<{ def: WidgetDefinition; size?: WidgetSize } | null>(null);

  const connected = connectedServiceIds(connections);
  const addableKeys = new Set(registry.addableWidgets(connected).map((w) => widgetKey(w.serviceId, w.type)));

  // ONE shelf across every service (registry order); each widget is a tile, connected (addable) or a ghost.
  // This is the whole catalog derived from the registry alone — the ghost half is the registry MINUS the
  // addable half, no service named.
  const q = search.trim().toLowerCase();
  const tiles: Tile[] = registry.services
    .flatMap((service) => service.widgets.map((def) => ({ def, service })))
    .filter(
      ({ def, service }) =>
        !q || def.title.toLowerCase().includes(q) || service.displayName.toLowerCase().includes(q),
    )
    .map(({ def, service }) => ({ def, service, addable: addableKeys.has(widgetKey(def.serviceId, def.type)) }));

  // The focused widget's live preview instance, placed at the EXACT slot useAddWidget will use (firstFreeSlot
  // at the SELECTED size — the same rule the arrange reflow shows, placement.ts/AOD-139). firstFreeSlot never
  // overlaps an existing card, so the neighbours never move; a larger flipped size that displaces them reflows
  // via the same rule (AOD-148 size-by-seeing). A ghost never previews (guarded on the addable set).
  const focusedDef = focused ? registry.getWidgetDef(focused.serviceId, focused.type) : undefined;
  const previewable =
    focusedDef && addableKeys.has(widgetKey(focusedDef.serviceId, focusedDef.type)) ? focusedDef : undefined;
  // The size the focused preview + its own tile render at (AOD-148). Defaults to the widget's default
  // placement size, guarded so a size carried from a prior focus this widget does not support falls back to
  // the default (belt-and-braces with the focusTile reset, so the preview never renders an unsupported slot).
  const effectiveSize: WidgetSize | null = previewable
    ? selectedSize && previewable.supportedSizes.includes(selectedSize)
      ? selectedSize
      : defaultPlacementSize(previewable.supportedSizes)
    : null;
  let previewInstance: WidgetInstance | null = null;
  if (previewable && effectiveSize) {
    previewInstance = {
      instanceId: '__add_preview__',
      serviceId: previewable.serviceId,
      widgetType: previewable.type,
      config: defaultConfig(previewable.configSchema),
      // AOD-197 (Pass B2): place on the ACTIVE orientation's column grid (via the `columns` prop, which is
      // columnsFor(orientation) from Dashboard) so the ringed preview lands at the SAME firstFreeSlot the add
      // will use — WYSIWYG in portrait (4 cols) as well as landscape (6). Defaults to GRID_COLUMNS.
      rect: defaultPlacementRect(effectiveSize, instances, columns),
      size: effectiveSize,
    };
  }

  // Focus a tile → preview it on the sky. Reset the size selection to the widget's default ONLY when focus
  // moves to a DIFFERENT widget (§2 size-by-seeing), so re-tapping the tile you are already previewing keeps
  // your pick, and a size never leaks from the previous widget.
  const focusTile = (def: WidgetDefinition) => {
    const same = focused?.serviceId === def.serviceId && focused?.type === def.type;
    setFocused({ serviceId: def.serviceId, type: def.type });
    if (!same) setSelectedSize(defaultPlacementSize(def.supportedSizes));
  };

  // Add-and-STAY: insert, then keep the gallery open for the next card ("Add never leaves Arrange"). A failure
  // is surfaced via `error`; the gallery (or the config form) stays so the user can retry. `size` lands the
  // card at the selected S/M/W/L (AOD-148); omitted keeps the default placement size.
  const addStay = async (def: WidgetDefinition, config?: Record<string, unknown>, size?: WidgetSize) => {
    try {
      await addWidget(def, config, size);
      setConfiguring(null);
    } catch {
      /* surfaced via `error`; stay open */
    }
  };

  const onAdd = (def: WidgetDefinition, size?: WidgetSize) => {
    if (requiresConfiguration(def.configSchema)) {
      setConfiguring({ def, size });
      return;
    }
    void addStay(def, undefined, size);
  };

  const goToSettings = () => {
    onClose();
    router.push('/settings');
  };

  // When configuring-on-add the config sheet takes over; a cancel returns to the gallery (setConfiguring null).
  // The size chosen before the form opened rides through and lands with the configured card (AOD-148).
  if (configuring) {
    return (
      <ResolvedConfigFormModal
        serviceId={configuring.def.serviceId}
        schema={configuring.def.configSchema}
        initial={defaultConfig(configuring.def.configSchema)}
        title={`Configure ${configuring.def.title}`}
        submitLabel="Add"
        pending={pending}
        submitError={error ? error.message : null}
        onSubmit={(values) => void addStay(configuring.def, values, configuring.size)}
        onCancel={() => setConfiguring(null)}
      />
    );
  }

  return (
    <Sheet visible onRequestClose={onClose} bottomInset={UnistylesRuntime.insets.bottom} testID="add-gallery">
      <View style={styles.header}>
        <Text style={styles.title}>Add a card</Text>
        <Button label="Close" variant="ghost" size="sm" onPress={onClose} testID="add-gallery-close" />
      </View>

      {error && (
        <Text style={styles.error} testID="add-gallery-error">
          {error.message}
        </Text>
      )}

      {isError ? (
        <Text style={styles.muted} testID="add-gallery-connections-error">
          Could not load your connections. Try again from Settings.
        </Text>
      ) : isLoading ? (
        <Text style={styles.muted}>Checking connections...</Text>
      ) : (
        // AOD-196: the sheet body is VERTICALLY scroll-contained so every shelf tile's "Add" button clears the
        // Android nav bar (off the wall the app is not immersive). flexShrink lets it shrink to the sheet's
        // maxHeight (85%) and scroll its overflow; the header + Close above stay fixed and always reachable, and
        // the Sheet's own paddingBottom already reserves the bottom inset. The horizontal shelf below stays its
        // own horizontal ScrollView (orthogonal nested scroll: vertical body, horizontal shelf).
        <ScrollView
          style={styles.bodyScroll}
          showsVerticalScrollIndicator={false}
          testID="add-gallery-body"
        >
          {/* §2a the sky above: your cards, scaled back a step, with the focused card previewed on it. */}
          <SkyPreview instances={instances} previewInstance={previewInstance} cellPx={cellPx} columns={columns} />

          {/* §2b's search field, borrowed verbatim: the magnifier filters the shelf. */}
          <View style={styles.searchRow}>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Find a card"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Find a card"
              testID="add-gallery-search"
            />
          </View>

          {tiles.length === 0 ? (
            <Text style={styles.muted} testID="add-gallery-no-matches">
              No cards match "{search}".
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelf}
              testID="add-gallery-shelf"
            >
              {tiles.map((tile) => {
                const isFocused =
                  focused?.serviceId === tile.def.serviceId && focused?.type === tile.def.type;
                // §2 "Added is visible": does an instance of THIS widget already sit on the current sky? A
                // generic membership test — serviceId + widgetType, never a service name.
                const alreadyAdded = instances.some(
                  (i) => i.serviceId === tile.def.serviceId && i.widgetType === tile.def.type,
                );
                // The focused tile renders its face at the SELECTED size (it flips with the preview); every
                // other tile (and every ghost, which is never focused) reads its default placement size.
                const tileSize =
                  isFocused && effectiveSize
                    ? effectiveSize
                    : defaultPlacementSize(tile.def.supportedSizes);
                return (
                  <ShelfTile
                    key={widgetKey(tile.def.serviceId, tile.def.type)}
                    tile={tile}
                    focused={isFocused}
                    size={tileSize}
                    alreadyAdded={alreadyAdded}
                    pending={pending}
                    onFocus={() => focusTile(tile.def)}
                    onSelectSize={setSelectedSize}
                    onAdd={() => onAdd(tile.def, isFocused ? effectiveSize ?? undefined : undefined)}
                    onConnect={goToSettings}
                  />
                );
              })}
            </ScrollView>
          )}
        </ScrollView>
      )}
    </Sheet>
  );
}

/** The read-only sky, scaled back a step: a silhouette of the placed cards (AOD-145's lighter approach) with
 *  the focused widget dropped on as a RINGED live preview (the real WidgetHost) at its firstFreeSlot landing.
 *  Positioned in a single `cell`-scaled space so the block footprints and the preview align; only the preview
 *  card is transform-scaled (so the REAL card shrinks into its slot, like the wall's scale layer). */
function SkyPreview({
  instances,
  previewInstance,
  cellPx,
  columns,
}: {
  instances: WidgetInstance[];
  previewInstance: WidgetInstance | null;
  cellPx: number;
  columns: number;
}) {
  const { theme } = useUnistyles();
  const { width: winW } = useWindowDimensions();
  // The measured width of the preview region (the Sheet's inner width). Seed from the window width (a good
  // approximation before layout) and refine on layout — the SkyPager pageWidth pattern.
  const [regionW, setRegionW] = useState(winW);
  const onRegionLayout = (e: LayoutChangeEvent) => setRegionW(e.nativeEvent.layout.width);

  const rects = [...instances.map((i) => i.rect), ...(previewInstance ? [previewInstance.rect] : [])];
  const contentRows = Math.max(1, ...rects.map((r) => r.y + r.h));
  // AOD-197 (S4): re-base the silhouette on the fit-to-width geometry. The cell fits the `columns`-wide grid
  // into the region WIDTH (regionW / columns) so the box never overflows as the column count grows (2 -> 6,
  // the S1 carry-forward), fits the content HEIGHT into the region (SKY_H / contentRows), and steps back a
  // notch — capped by SKY_MAX_CELL and by the real on-screen cellPx (never zoom past the live card size).
  const cell = Math.min(SKY_MAX_CELL, cellPx, SKY_H / contentRows, regionW / columns);
  const scale = cell / UNIT_PX;
  const previewPx = previewInstance ? slotToPixels(previewInstance.rect) : null;

  return (
    <View style={[styles.sky, { height: SKY_H }]} testID="add-gallery-sky" onLayout={onRegionLayout}>
      <View style={{ width: columns * cell, height: contentRows * cell }}>
        {/* The placed cards as proportional blocks — the "room" you judge (non-interactive). */}
        {instances.map((inst) => (
          <View
            key={inst.instanceId}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: inst.rect.x * cell,
              top: inst.rect.y * cell,
              width: Math.max(2, inst.rect.w * cell - SILHOUETTE_GAP),
              height: Math.max(2, inst.rect.h * cell - SILHOUETTE_GAP),
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.textMuted,
              opacity: 0.5,
            }}
          />
        ))}

        {/* The RINGED live preview: the real card (WidgetHost) at its landing slot, ringed in the AOD-140
            selection language (accent border + accentMuted wash). The card renders at full slot pixels and is
            transform-scaled into the cell box (transformOrigin top-left, like the wall). */}
        {previewInstance && previewPx ? (
          <View
            testID="add-gallery-sky-preview"
            style={{
              position: 'absolute',
              left: previewInstance.rect.x * cell,
              top: previewInstance.rect.y * cell,
              width: previewInstance.rect.w * cell,
              height: previewInstance.rect.h * cell,
              borderRadius: theme.radius.md,
              borderWidth: 2,
              borderColor: theme.colors.accent,
              backgroundColor: theme.colors.accentMuted,
              overflow: 'hidden',
            }}
          >
            <View
              pointerEvents="none"
              style={{ width: previewPx.width, height: previewPx.height, transform: [{ scale }], transformOrigin: 'left top' }}
            >
              <WidgetHost instance={previewInstance} />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** One shelf tile: the widget's own card via the generic WidgetHostView. A CONNECTED widget shows its live
 *  face (rendered at `size` — the SELECTED size when focused, so the face flips with the preview) and is
 *  pressable to focus (preview) + carries an Add. When focused it also shows the S/M/W/L size selector
 *  (AOD-148). A widget already on the sky wears the "• ON THIS SKY" mark and its action becomes "Add again"
 *  (`alreadyAdded`) — a duplicate is still allowed. A GHOST (unconnected) shows the not-yet-lit state (the
 *  AOD-125 `ghost` the lifecycle DESIGN FLAG reserves for exactly this preview) and states its price + a
 *  Connect that routes to Settings (the in-place connect is AOD-149). No per-service code. */
function ShelfTile({
  tile,
  focused,
  size,
  alreadyAdded,
  pending,
  onFocus,
  onSelectSize,
  onAdd,
  onConnect,
}: {
  tile: Tile;
  focused: boolean;
  size: WidgetSize;
  alreadyAdded: boolean;
  pending: boolean;
  onFocus(): void;
  onSelectSize(size: WidgetSize): void;
  onAdd(): void;
  onConnect(): void;
}) {
  const { theme } = useUnistyles();
  const { def, service, addable } = tile;
  const config = defaultConfig(def.configSchema);
  const idBase = `${def.serviceId}-${def.type}`;

  if (!addable) {
    return (
      <View style={styles.tileColumn} testID={`add-gallery-ghost-${idBase}`}>
        <View style={[styles.tileFace, { borderColor: theme.colors.border }]} pointerEvents="none">
          <WidgetHostView state={{ phase: 'ghost' }} def={def} size={size} config={config} serviceName={service.displayName} />
        </View>
        <Text style={styles.price} numberOfLines={1}>
          Needs {connectPrice(service.authClass)}
        </Text>
        <Button label="Connect" variant="secondary" size="sm" onPress={onConnect} testID={`add-gallery-connect-${idBase}`} />
      </View>
    );
  }

  return (
    <View style={styles.tileColumn}>
      <Pressable
        onPress={onFocus}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={`Preview ${def.title}`}
        testID={`add-gallery-tile-${idBase}`}
        style={[
          styles.tileFace,
          focused
            ? { borderColor: theme.colors.accent, borderWidth: 2, backgroundColor: theme.colors.accentMuted }
            : { borderColor: theme.colors.border },
        ]}
      >
        <View pointerEvents="none">
          <WidgetHostView state={{ phase: 'live', data: undefined, fetchedAt: Date.now() }} def={def} size={size} config={config} serviceName={service.displayName} />
        </View>
      </Pressable>

      {/* §2 "Added is visible": a quiet mark when this widget already sits on the sky. The action below stays
          live as "Add again" — a duplicate is allowed, never silent, never disabled. */}
      {alreadyAdded && (
        <Text style={styles.onSky} numberOfLines={1} testID={`add-gallery-onsky-${idBase}`}>
          • ON THIS SKY
        </Text>
      )}

      {/* §2 "Size is chosen by seeing": only the focused tile carries the S/M/W/L selector ("sizes wait until
          it's lit"). Selecting flips this face AND the on-sky preview together (the parent recomputes both
          from the size). Options are the widget's supportedSizes in canonical order — no per-service code. */}
      {focused && (
        <Segmented
          options={sizeOptions(def.supportedSizes)}
          value={size}
          onChange={onSelectSize}
          testID={`add-gallery-size-${idBase}`}
        />
      )}

      <Button
        label={alreadyAdded ? 'Add again' : 'Add'}
        variant="primary"
        size="sm"
        onPress={onAdd}
        disabled={pending}
        testID={`add-gallery-add-${idBase}`}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(2),
  },
  title: {
    ...theme.type.title,
    color: theme.colors.text,
  },
  error: {
    ...theme.type.meta,
    color: theme.colors.error,
    marginBottom: theme.spacing(2),
  },
  muted: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
    paddingVertical: theme.spacing(3),
  },
  // §2a the scaled sky region: a fixed window, the content top-anchored + centered, clipped like the wall.
  sky: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
    marginBottom: theme.spacing(2),
  },
  // AOD-196 the vertical body scroll: flexShrink lets it shrink to the sheet's maxHeight and scroll its
  // overflow so every "Add" clears the nav bar; the header/Close above stay fixed.
  bodyScroll: {
    flexShrink: 1,
  },
  searchRow: {
    marginBottom: theme.spacing(3),
  },
  shelf: {
    flexDirection: 'row',
    gap: theme.spacing(3),
    paddingBottom: theme.spacing(2),
  },
  tileColumn: {
    width: TILE_W,
    gap: theme.spacing(2),
  },
  // The tile card box: fixed + clipped so any widget's face fits at a glance (proportion-sized tiles = AOD-148).
  tileFace: {
    height: TILE_H,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  price: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  // §2 the "• ON THIS SKY" already-added mark: a quiet caption, same weight as the ghost price so it reads
  // as an annotation on the tile, not an alarm (device legibility judged in AOD-190).
  onSky: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
}));
