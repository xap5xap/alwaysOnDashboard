// The AOD-195 long-press quick-actions menu: the iPhone/iPad Home-Screen context menu for a placed card,
// replacing the AOD-142 Glance/Arrange dial's "enter edit" role. A long-press on a card opens THIS anchored
// menu; every item is a NEW ENTRY POINT to an action that already exists — Edit Widget -> our existing
// ConfigureInstanceModal (NOT an inline card-flip config), Edit Screen -> Arrange, Delete -> the AOD-141
// confirm, and an S/M/W/L row -> the AOD-140 resize/persist path. It names no service (AOD-8 §10 seam): it
// resolves the widget def from the registry only to decide which items apply — Edit Widget when the widget
// declares config fields, the size row when it supports more than one size — never branching on a service id.
// DS primitives only: Popover + MenuItem (ui/Overlays, the Theme picker's controls) + the AOD-148 Segmented
// size selector, reused, not rebuilt.
import React from 'react';
import { Pressable, StyleSheet as RNStyleSheet, useWindowDimensions, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useRegistry } from '../registry/RegistryProvider';
import type { WidgetInstance, WidgetSize } from '../registry/types';
import { MenuItem, Popover, Segmented, type SegmentedOption } from '../ui';

// The size selector's canonical S -> M -> W -> L order, filtered to what the widget supports (mirrors the
// AOD-148 Add-gallery helper). Kept local so the menu needs no change to AddGallery or the pure sizes module.
const SIZE_ORDER: readonly WidgetSize[] = ['S', 'M', 'W', 'L'];
function sizeOptions(supported: WidgetSize[]): SegmentedOption<WidgetSize>[] {
  return SIZE_ORDER.filter((s) => supported.includes(s)).map((s) => ({ label: s, value: s }));
}

// The estimated menu box for on-screen clamping (the Popover is minWidth 180; the height varies with the item
// count). The anchor is the long-press point (window coords); the menu opens there, nudged in so the whole box
// never hangs off an edge. Exact placement + a hold-preview are device feel (AOD-190); these are the seeds.
const MENU_W = 200;
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
   *  nearest-free re-validation). The menu STAYS open so the segmented reflects the applied size. */
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
  const def = registry.getWidgetDef(instance.serviceId, instance.widgetType);
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Edit Widget only when the widget has something to configure (declares config fields) — the iPad rule
  // (Notes yes / Apple Music no; Clock no / Linear·Weather·Calendar yes). Generic: fields.length, never a
  // service name; a `configSchema` with an empty `fields` array is "nothing to configure".
  const configurable = (def?.configSchema.fields.length ?? 0) > 0;
  // The size row only when the widget supports MORE than one footprint (a single-size widget shows none).
  const supported = def?.supportedSizes ?? [instance.size];
  const sizes = supported.length > 1 ? sizeOptions(supported) : null;

  // Anchor the menu at the long-press point, clamped so the whole box stays on screen.
  const left = Math.max(EDGE, Math.min(anchor.x, screenW - MENU_W - EDGE));
  const top = Math.max(EDGE, Math.min(anchor.y, screenH - MENU_H - EDGE));

  return (
    <View style={RNStyleSheet.absoluteFill} testID={`${testID}-overlay`}>
      {/* No scrim (a Popover hangs off a known trigger, §9 rule): a transparent full-screen catcher dismisses
          on any outside tap. */}
      <Pressable style={RNStyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss menu" testID={`${testID}-scrim`} />
      <View style={[styles.anchored, { left, top }]}>
        {/* Popover.toArray filters the conditional nulls, so a missing Edit Widget / size row leaves no empty
            divider. */}
        <Popover testID={testID}>
          {configurable ? <MenuItem label="Edit Widget" onPress={onEditWidget} testID={`${testID}-edit-widget`} /> : null}
          <MenuItem label="Edit Screen" onPress={onEditScreen} testID={`${testID}-edit-screen`} />
          <MenuItem label="Delete Widget" onPress={onDeleteWidget} testID={`${testID}-delete-widget`} />
          {sizes ? (
            <View style={styles.sizeRow} testID={`${testID}-size-row`}>
              <Segmented options={sizes} value={instance.size} onChange={onSelectSize} testID={`${testID}-size`} />
            </View>
          ) : null}
        </Popover>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  anchored: { position: 'absolute' },
  // The size row sits under the menu items (a Popover child), padded to match a MenuItem's touch inset.
  sizeRow: {
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2.5),
    alignItems: 'flex-start',
  },
}));
