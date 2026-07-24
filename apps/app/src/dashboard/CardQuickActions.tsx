// The AOD-195 long-press quick-actions menu: the iPhone/iPad Home-Screen context menu for a placed card,
// replacing the AOD-142 Glance/Arrange dial's "enter edit" role. A long-press on a card opens THIS anchored
// menu; every item is a NEW ENTRY POINT to an action that already exists — Edit Widget -> our existing
// ConfigureInstanceModal (NOT an inline card-flip config), Edit Screen -> Arrange, Delete -> the AOD-141
// confirm, and an S/M/W/L row -> the AOD-140 resize/persist path. It names no service (AOD-8 §10 seam): it
// resolves the widget def from the registry only to decide which items apply — Edit Widget when the widget
// declares config fields, the size row when it supports more than one size — never branching on a service id.
//
// AOD-211 (design-quick-actions-menu.md, restyle only — the AOD-195 behaviour + item set above are UNCHANGED):
// this dresses the menu to the locked Vela bar. Leading thin-stroke icons on every row (sliders / two-pane /
// circle-minus), Delete as red INK on a neutral pressed fill (never a red fill), a hairline BEAK that points
// at the touch, and a trackless FOOTPRINT size picker (a NEW control, not the AOD-148 Segmented — §9). The
// "this is the one you grabbed" focus highlight is the long-pressed card BRIGHTENING ITS OWN border (threaded
// via Dashboard's menuTargetId -> WidgetHostView), aligned by construction — NOT an overlay dim/ring, which
// cannot hug a content-sized card. Geometry + roles come from the quickMenu token group (§10); the anchor math
// (EDGE clamp) is AOD-195's, unchanged.
import React from 'react';
import { Pressable, StyleSheet as RNStyleSheet, useWindowDimensions, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRegistry } from '../registry/RegistryProvider';
import type { WidgetInstance, WidgetSize } from '../registry/types';
import { AdjustGlyph, LayoutGlyph, MenuItem, MinusCircleGlyph, Popover } from '../ui';
import { FootprintSizePicker } from './FootprintSizePicker';

// The size selector's canonical S -> M -> W -> L order, filtered to what the widget supports (mirrors the
// AOD-148 Add-gallery helper). Kept local so the menu needs no change to AddGallery or the pure sizes module.
const SIZE_ORDER: readonly WidgetSize[] = ['S', 'M', 'W', 'L'];
function sizeOptions(supported: WidgetSize[]): WidgetSize[] {
  return SIZE_ORDER.filter((s) => supported.includes(s));
}

// The estimated menu box for on-screen clamping (the Popover minWidth is quickMenu.minWidth; the height varies
// with the item count). The anchor is the long-press point (window coords); the menu opens there, nudged in so
// the whole box never hangs off an edge (AOD-195 anchor math, EDGE = 12, unchanged).
const MENU_H = 280;
const EDGE = 12;

export interface CardQuickActionsProps {
  /** The long-pressed card. The registry def resolved from it decides which items show; its `size` drives the
   *  size row's current selection (Dashboard hands the LIVE instance so a re-snap re-marks the row). */
  instance: WidgetInstance;
  /** The on-screen long-press point (window coords, from the gesture's absoluteX/absoluteY). */
  anchor: { x: number; y: number };
  /** Edit Widget -> open the per-instance config sheet (ConfigureInstanceModal). Only shown when configurable. */
  onEditWidget(): void;
  /** Edit Screen -> enter Arrange on this card's sky in the current orientation (design §9). Always shown. */
  onEditScreen(): void;
  /** Delete Widget -> the AOD-141 tile-face confirm (rendered outside Arrange). Always shown. */
  onDeleteWidget(): void;
  /** Pick a size -> re-snap the card immediately (Dashboard commits via the AOD-140 path with AOD-197
   *  nearest-free re-validation). The menu STAYS open so the picker reflects the applied size. */
  onSelectSize(size: WidgetSize): void;
  /** Outside tap -> dismiss. */
  onDismiss(): void;
  testID?: string;
}

export function CardQuickActions({
  instance,
  anchor,
  onEditWidget,
  onEditScreen,
  onDeleteWidget,
  onSelectSize,
  onDismiss,
  testID = 'card-quick-actions',
}: CardQuickActionsProps) {
  const registry = useRegistry();
  const { theme } = useUnistyles();
  const q = theme.quickMenu;
  const def = registry.getWidgetDef(instance.serviceId, instance.widgetType);
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Edit Widget only when the widget has something to configure (declares config fields) — the iPad rule
  // (Notes yes / Apple Music no; Clock no / Linear·Weather·Calendar yes). Generic: fields.length, never a
  // service name; a `configSchema` with an empty `fields` array is "nothing to configure".
  const configurable = (def?.configSchema.fields.length ?? 0) > 0;
  // The size row only when the widget supports MORE than one footprint (a single-size widget shows none).
  const supported = def?.supportedSizes ?? [instance.size];
  const sizes = supported.length > 1 ? sizeOptions(supported) : null;

  // Anchor the menu at the long-press point, clamped so the whole box stays on screen (AOD-195 math). menuW is
  // the real min width (quickMenu.minWidth) so the clamp + beak offset use the box's actual width.
  const menuW = q.minWidth;
  const left = Math.max(EDGE, Math.min(anchor.x, screenW - menuW - EDGE));
  const top = Math.max(EDGE, Math.min(anchor.y, screenH - MENU_H - EDGE));

  // §7 the beak: it sits on the edge NEAREST the touch and slides along that edge to stay pointed at it. When
  // the box was nudged UP (its top ended above the touch, near the screen bottom) the beak flips to the bottom
  // edge; otherwise it points up from the top edge at the touch. The offset is clamped within the corner radii
  // so the beak never rides off the rounded corner.
  const beakEdge: 'top' | 'bottom' = top >= anchor.y ? 'top' : 'bottom';
  const rMd = theme.radius.md;
  const beakOffset = Math.max(rMd + q.beak.w / 2, Math.min(anchor.x - left, menuW - rMd - q.beak.w / 2));

  return (
    <View style={RNStyleSheet.absoluteFill} testID={`${testID}-overlay`}>
      {/* No overlay dim (the §9 field dim was dropped after dogfood — it can't hug a content-sized card
          without spilling past it). The focus cue is the pressed card brightening its OWN border, threaded
          via menuTargetId. A transparent full-screen catcher dismisses on any outside tap. */}
      <Pressable style={RNStyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss menu" testID={`${testID}-scrim`} />
      <View style={[styles.anchored, { left, top }]}>
        {/* Popover.toArray filters the conditional nulls, so a missing Edit Widget / size row leaves no empty
            divider. The beak points at the touch (§7); minWidth is the menu's own (quickMenu.minWidth). */}
        <Popover testID={testID} minWidth={menuW} beak={{ edge: beakEdge, offset: beakOffset }}>
          {configurable ? (
            <MenuItem
              label="Edit Widget"
              icon={(c) => <AdjustGlyph color={c} size={q.icon.size} />}
              onPress={onEditWidget}
              testID={`${testID}-edit-widget`}
            />
          ) : null}
          <MenuItem
            label="Edit Screen"
            icon={(c) => <LayoutGlyph color={c} size={q.icon.size} />}
            onPress={onEditScreen}
            testID={`${testID}-edit-screen`}
          />
          <MenuItem
            label="Delete Widget"
            icon={(c) => <MinusCircleGlyph color={c} size={q.icon.size} />}
            destructive
            onPress={onDeleteWidget}
            testID={`${testID}-delete-widget`}
          />
          {sizes ? (
            <View style={styles.sizeRow} testID={`${testID}-size-row`}>
              <FootprintSizePicker options={sizes} value={instance.size} onChange={onSelectSize} testID={`${testID}-size`} />
            </View>
          ) : null}
        </Popover>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  anchored: { position: 'absolute' },
  // The footprint size row sits under the menu items (a Popover child), padded to match a MenuItem's inset.
  sizeRow: {
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(2),
    alignItems: 'flex-start',
  },
}));
