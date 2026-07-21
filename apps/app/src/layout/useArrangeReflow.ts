// The arrange-session state + commit wiring (AOD-140): the thin, testable React layer between the gesture
// host (PlacedInstance, which reports its live target slot) and the pure orchestration (arrange.ts). It
// holds the ONE active target on the JS thread, derives the reflow preview every neighbour animates to,
// and — on drop — fires the per-instance commit for the dragged card AND every neighbour the reflow moved.
// LayoutCanvas owns this hook because it holds all instances (the AOD-140 architecture: the canvas
// orchestrates the reflow, each PlacedInstance only reports its own gesture). Registry-free: it speaks
// WidgetInstance/LayoutPatch, never a service.
//
// The wall callers (KioskWall / WallPreview) mount LayoutCanvas with arranging=false and a noop commit and
// never fire a gesture, so the hook stays at { target: null } there — inert, no reflow, no wall-render
// change (the AOD-140 "don't touch the wall render path" line holds structurally).
import { useCallback, useMemo, useState } from 'react';
import type { LayoutRect, WidgetInstance } from '../registry/types';
import type { GridRect } from './grid';
import type { LayoutPatch } from './mapper';
import { type ArrangeTarget, collectArrangeCommits, reflowForTarget } from './arrange';

export interface ArrangeReflow {
  /** The id of the card being dragged/resized right now, or null when no gesture is active. */
  activeId: string | null;
  /** The slot the active card will land on (origin + footprint), for the hairline LayoutCanvas draws.
   *  Null when idle. */
  activeSlot: GridRect | null;
  /** The reflowed (uncommitted) rect a card should animate toward during the active gesture, or null —
   *  which means "rest at your committed rect" (this IS the active card, or nothing is being dragged). */
  previewFor(instanceId: string): LayoutRect | null;
  /** A gesture crossed a grid boundary (drag origin moved) or flipped size (resize footprint): update the
   *  live target so the preview + hairline follow. Slot-change granularity — PlacedInstance only calls this
   *  when the SNAPPED target actually changes, not every frame. */
  onArrangeMove(instanceId: string, slot: GridRect): void;
  /** The gesture ended: persist the active card + every neighbour the reflow displaced (arrange.ts), then
   *  clear the session. Uses the final slot passed here (== the last previewed one), so what persists is
   *  exactly what was on screen. */
  onArrangeEnd(instanceId: string, slot: GridRect): void;
  /** The gesture was cancelled (not completed): drop the preview, commit nothing. Neighbours animate back
   *  to their committed rects (PlacedInstance) because previewFor goes null again. */
  onArrangeCancel(): void;
}

export function useArrangeReflow(
  instances: WidgetInstance[],
  commit: (instanceId: string, patch: LayoutPatch) => void,
): ArrangeReflow {
  // The single in-flight gesture target. One finger, one active card, so one target suffices (a second
  // gesture cannot start while this one holds; PlacedInstance gates on arranging + not-confirming).
  const [target, setTarget] = useState<ArrangeTarget | null>(null);

  // The whole-board reflow for the current target. Recomputes only when the target or the committed
  // instances change; during a gesture `instances` is stable (commits fire on END), so this tracks the
  // finger, not React churn. Null while idle keeps the common (Glance/wall) path allocation-free.
  const preview = useMemo(() => (target ? reflowForTarget(instances, target) : null), [target, instances]);

  const onArrangeMove = useCallback((instanceId: string, slot: GridRect) => {
    setTarget({ instanceId, slot });
  }, []);

  const onArrangeEnd = useCallback(
    (instanceId: string, slot: GridRect) => {
      // A true IN-PLACE drop (the active card lands on its own committed slot, same footprint) must change
      // NOTHING — no reflow, no writes — even when the board has a pre-existing gap (e.g. a removed widget
      // left a hole; useRemoveWidget does not compact). Reflow/compaction is reserved for an actual move, so
      // tapping a card and releasing it never makes OTHER cards jump (the from:dogfood arrange pain). A real
      // move still re-packs reading-order gaps via grid.reflow (the AOD-138 springboard behaviour).
      const active = instances.find((i) => i.instanceId === instanceId);
      const inPlace =
        active != null &&
        active.rect.x === slot.x &&
        active.rect.y === slot.y &&
        active.rect.w === slot.w &&
        active.rect.h === slot.h;
      if (!inPlace) {
        // Recompute against the committed instances (unchanged since the gesture began) + the FINAL slot, so
        // the persisted layout is byte-identical to the last preview. Fire one commit per moved instance;
        // useDashboard's per-instance optimistic update repaints and its debounce coalesces the RLS writes.
        const reflowed = reflowForTarget(instances, { instanceId, slot });
        for (const c of collectArrangeCommits(instances, reflowed)) commit(c.instanceId, c.patch);
      }
      setTarget(null);
    },
    [instances, commit],
  );

  const onArrangeCancel = useCallback(() => setTarget(null), []);

  const previewFor = useCallback(
    (instanceId: string): LayoutRect | null => {
      // The active card is driven by its own gesture (finger for drag, live footprint for resize), never by
      // the preview — returning null here is what keeps the reflow effect from fighting the gesture.
      if (!target || instanceId === target.instanceId) return null;
      return preview?.get(instanceId) ?? null;
    },
    [target, preview],
  );

  return {
    activeId: target?.instanceId ?? null,
    activeSlot: target?.slot ?? null,
    previewFor,
    onArrangeMove,
    onArrangeEnd,
    onArrangeCancel,
  };
}
