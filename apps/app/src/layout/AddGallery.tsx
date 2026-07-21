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
// (tap; device auto-center-on-scroll is AOD-190) previews it above. Add lands it at the default size and — "Add
// never leaves Arrange" — the gallery STAYS for the next card. A required-no-default widget still routes through
// the config form first (configure-on-add, AOD-10 §4). A ghost tile's action is the current connect-via-Settings
// path (the in-place ghost-connect is AOD-149, deferred). The S/M/W/L size selector + the "• ON THIS SKY"
// already-added mark are AOD-148 (next); this gallery uses the default size and shows no already-added marks.
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, UnistylesRuntime, useUnistyles } from 'react-native-unistyles';
import { connectedServiceIds } from '../connections/connectionsRepo';
import { useConnections } from '../connections/useConnections';
import { WidgetHost } from '../host/WidgetHost';
import { WidgetHostView } from '../host/WidgetHostView';
import { useRegistry } from '../registry/RegistryProvider';
import type { AuthClass, ServiceDefinition, WidgetDefinition, WidgetInstance } from '../registry/types';
import { GRID_COLUMNS } from '../widgets/sizes';
import { ResolvedConfigFormModal } from '../widgets/ResolvedConfigFormModal';
import { Button, Input, Sheet } from '../ui';
import { UNIT_PX } from './geometry';
import { slotToPixels } from './grid';
import { defaultConfig, defaultPlacementRect, defaultPlacementSize, requiresConfiguration } from './placement';
import { useAddWidget } from './useAddWidget';
import { useDashboard } from './useDashboard';

export interface AddGalleryProps {
  onClose(): void;
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

export function AddGallery({ onClose }: AddGalleryProps) {
  const registry = useRegistry();
  const { connections, isLoading, isError } = useConnections();
  const { addWidget, pending, error } = useAddWidget();
  // The active sky, read reactively from the same cache useAddWidget writes into, so the silhouette + the
  // firstFreeSlot preview track an add (a provisional appears immediately). Registry-free: it is just geometry.
  const { instances } = useDashboard();

  const [search, setSearch] = useState('');
  // The focused (centered) widget → its live preview on the sky. Null = browsing: the sky shows exactly what
  // you have (§2a). Only an ADDABLE widget focuses (a ghost has no live card; its action is Connect).
  const [focused, setFocused] = useState<{ serviceId: string; type: string } | null>(null);
  // configure-on-add: a required-no-default widget routes through the config form before insert (AOD-10 §4);
  // everything else adds with schema defaults (AOD-51).
  const [configuring, setConfiguring] = useState<WidgetDefinition | null>(null);

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

  // The focused widget's live preview instance, placed at the EXACT slot useAddWidget will use (firstFreeSlot at
  // the default size — the same rule the arrange reflow shows, placement.ts/AOD-139). firstFreeSlot never
  // overlaps an existing card, so the neighbours never move for a default-size add; the reflow-if-displaced path
  // is exercised by the AOD-148 size flip. A ghost never previews (guarded on the addable set).
  const focusedDef = focused ? registry.getWidgetDef(focused.serviceId, focused.type) : undefined;
  const previewable =
    focusedDef && addableKeys.has(widgetKey(focusedDef.serviceId, focusedDef.type)) ? focusedDef : undefined;
  let previewInstance: WidgetInstance | null = null;
  if (previewable) {
    const size = defaultPlacementSize(previewable.supportedSizes);
    previewInstance = {
      instanceId: '__add_preview__',
      serviceId: previewable.serviceId,
      widgetType: previewable.type,
      config: defaultConfig(previewable.configSchema),
      rect: defaultPlacementRect(size, instances),
      size,
    };
  }

  // Add-and-STAY: insert, then keep the gallery open for the next card ("Add never leaves Arrange"). A failure
  // is surfaced via `error`; the gallery (or the config form) stays so the user can retry.
  const addStay = async (def: WidgetDefinition, config?: Record<string, unknown>) => {
    try {
      await addWidget(def, config);
      setConfiguring(null);
    } catch {
      /* surfaced via `error`; stay open */
    }
  };

  const onAdd = (def: WidgetDefinition) => {
    if (requiresConfiguration(def.configSchema)) {
      setConfiguring(def);
      return;
    }
    void addStay(def);
  };

  const goToSettings = () => {
    onClose();
    router.push('/settings');
  };

  // When configuring-on-add the config sheet takes over; a cancel returns to the gallery (setConfiguring null).
  if (configuring) {
    return (
      <ResolvedConfigFormModal
        serviceId={configuring.serviceId}
        schema={configuring.configSchema}
        initial={defaultConfig(configuring.configSchema)}
        title={`Configure ${configuring.title}`}
        submitLabel="Add"
        pending={pending}
        submitError={error ? error.message : null}
        onSubmit={(values) => void addStay(configuring, values)}
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
        <>
          {/* §2a the sky above: your cards, scaled back a step, with the focused card previewed on it. */}
          <SkyPreview instances={instances} previewInstance={previewInstance} />

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
              {tiles.map((tile) => (
                <ShelfTile
                  key={widgetKey(tile.def.serviceId, tile.def.type)}
                  tile={tile}
                  focused={
                    focused?.serviceId === tile.def.serviceId && focused?.type === tile.def.type
                  }
                  pending={pending}
                  onFocus={() => setFocused({ serviceId: tile.def.serviceId, type: tile.def.type })}
                  onAdd={() => onAdd(tile.def)}
                  onConnect={goToSettings}
                />
              ))}
            </ScrollView>
          )}
        </>
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
}: {
  instances: WidgetInstance[];
  previewInstance: WidgetInstance | null;
}) {
  const { theme } = useUnistyles();
  const rects = [...instances.map((i) => i.rect), ...(previewInstance ? [previewInstance.rect] : [])];
  const contentRows = Math.max(1, ...rects.map((r) => r.y + r.h));
  // Fit the content height into the region, capped at the "step back" cell so a short sky is not blown up.
  const cell = Math.min(SKY_MAX_CELL, SKY_H / contentRows);
  const scale = cell / UNIT_PX;
  const previewPx = previewInstance ? slotToPixels(previewInstance.rect) : null;

  return (
    <View style={[styles.sky, { height: SKY_H }]} testID="add-gallery-sky">
      <View style={{ width: GRID_COLUMNS * cell, height: contentRows * cell }}>
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
 *  face and is pressable to focus (preview) + carries an Add. A GHOST (unconnected) shows the not-yet-lit
 *  state (the AOD-125 `ghost` the lifecycle DESIGN FLAG reserves for exactly this preview) and states its
 *  price + a Connect that routes to Settings (the in-place connect is AOD-149). No per-service code. */
function ShelfTile({
  tile,
  focused,
  pending,
  onFocus,
  onAdd,
  onConnect,
}: {
  tile: Tile;
  focused: boolean;
  pending: boolean;
  onFocus(): void;
  onAdd(): void;
  onConnect(): void;
}) {
  const { theme } = useUnistyles();
  const { def, service, addable } = tile;
  const size = defaultPlacementSize(def.supportedSizes);
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
      <Button label="Add" variant="primary" size="sm" onPress={onAdd} disabled={pending} testID={`add-gallery-add-${idBase}`} />
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
}));
