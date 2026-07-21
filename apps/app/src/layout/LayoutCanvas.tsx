// The free-form layout engine (AOD-7): a generic surface that places WidgetInstances absolutely and,
// in arrange mode, lets each be dragged and resized. It is generic over WidgetInstance/LayoutRect and
// imports NO service (AOD-8 §10 seam): adding an integration never touches this file. The parent
// (Dashboard) owns the arranging flag and drives it with the AOD-142 Glance | Arrange dial; a long-press
// on any card (AOD-49) is a shortcut INTO arrange, and the tap-empty-canvas catcher below is a convenience
// exit (onExitArrange) that sits alongside the dial. The wall callers (KioskWall / WallPreview) pass a noop
// exit and never arrange, so the catcher is inert there.
import React from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetInstance } from '../registry/types';
import type { LayoutPatch } from './mapper';
import { PlacedInstance } from './PlacedInstance';

export interface LayoutCanvasProps {
  instances: WidgetInstance[];
  arranging: boolean;
  onEnterArrange(): void;
  onExitArrange(): void;
  onCommit(instanceId: string, patch: LayoutPatch): void;
  /** Open the config form for one instance (AOD-10 §4); the dashboard owns the modal. */
  onRequestConfigure(instance: WidgetInstance): void;
  /** Delete one instance (AOD-141); the dashboard owns the mutation. Fired from the arrange-mode
   *  in-place "Remove?" confirm. The wall callers pass a noop (they never arrange). */
  onRemove(instanceId: string): void;
}

export function LayoutCanvas({
  instances,
  arranging,
  onEnterArrange,
  onExitArrange,
  onCommit,
  onRequestConfigure,
  onRemove,
}: LayoutCanvasProps) {
  return (
    <View style={styles.canvas}>
      {/* Behind the cards: a full-bleed catcher so a tap on empty space leaves arrange mode. */}
      {arranging ? (
        <Pressable style={styles.exitCatcher} onPress={onExitArrange} accessibilityLabel="Done arranging" />
      ) : null}
      {instances.map((instance) => (
        <PlacedInstance
          key={instance.instanceId}
          instance={instance}
          arranging={arranging}
          onLongPress={onEnterArrange}
          onCommit={onCommit}
          onRequestConfigure={onRequestConfigure}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create(() => ({
  canvas: {
    flex: 1,
    position: 'relative',
  },
  exitCatcher: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
}));
