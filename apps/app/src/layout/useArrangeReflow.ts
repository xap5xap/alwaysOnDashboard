// The arrange-session state + commit wiring (AOD-140; "place, don't pack" since AOD-197 S4): the thin,
// testable React layer between the gesture host (PlacedInstance, which reports its live target slot) and the
// pure orchestration (arrange.ts). It holds the ONE active target on the JS thread, derives the nearest-free
// landing slot the hairline shows, and — on drop — fires ONE commit for the active card only.
//
// AOD-197 (S4, design §8): a move relocates ONLY the dragged card; every neighbour holds its committed slot,
// so gaps are preserved (the from:dogfood arrange pain was the opposite — neighbours packed on every move).
// The hairline snaps to the NEAREST FREE fitting slot (grid.nearestFreeSlot, via arrange.placeActive)
// computed against the OTHER cards; `previewFor` is therefore ALWAYS null (no neighbour ever animates), and
// the drop commits just the active card at that slot (arrange.activeCommit). `columns` is the active
// orientation's count (landscape 6 / portrait 4), threaded from LayoutCanvas.
//
// The wall callers (KioskWall / WallPreview) mount LayoutCanvas with arranging=false and a noop commit and
// never fire a gesture, so the hook stays at { target: null } there — inert, no placement, no wall-render
// change (the AOD-140 "don't touch the wall render path" line holds structurally).
import { useCallback, useMemo, useState } from 'react';
import type { LayoutRect, WidgetInstance } from '../registry/types';
import { GRID_COLUMNS } from '../widgets/sizes';
import type { GridRect } from './grid';
import type { LayoutPatch } from './mapper';
import { type ArrangeTarget, activeCommit, placeActive } from './arrange';

export interface ArrangeReflow {
  /** The id of the card being dragged/resized right now, or null when no gesture is active. */
  activeId: string | null;
  /** The slot the active card will land on (origin + footprint) — the NEAREST FREE fitting slot to the
   *  gesture target (design §8), for the hairline LayoutCanvas draws. Null when idle. */
  activeSlot: GridRect | null;
  /** ALWAYS null under place-don't-pack (AOD-197 S4): neighbours never move, so no card animates toward a
   *  reflowed rect. Kept in the interface (LayoutCanvas passes it to every PlacedInstance) so the card rests
   *  at its committed rect; the signature is unchanged from the AOD-140 pack era. */
  previewFor(instanceId: string): LayoutRect | null;
  /** A gesture crossed a grid boundary (drag origin moved) or flipped size (resize footprint): update the
   *  live target so the hairline follows. Slot-change granularity — PlacedInstance only calls this when the
   *  SNAPPED target actually changes, not every frame. */
  onArrangeMove(instanceId: string, slot: GridRect): void;
  /** The gesture ended: persist the active card at its nearest-free landing (arrange.activeCommit), then
   *  clear the session. Only the active card ever commits; an in-place drop commits nothing. RETURNS that
   *  nearest-free landing (design §8) so the gesture host settles the card exactly where the hairline showed
   *  — INCLUDING the no-op case where the landing equals the card's own origin, so a drop onto an occupied
   *  neighbour never leaves the card resting on top of it (the hairline promised a free slot; the card lands
   *  there, never on the neighbour). */
  onArrangeEnd(instanceId: string, slot: GridRect): GridRect;
  /** The gesture was cancelled (not completed): drop the target, commit nothing. */
  onArrangeCancel(): void;
}

export function useArrangeReflow(
  instances: WidgetInstance[],
  commit: (instanceId: string, patch: LayoutPatch) => void,
  columns: number = GRID_COLUMNS,
): ArrangeReflow {
  // The single in-flight gesture target. One finger, one active card, so one target suffices (a second
  // gesture cannot start while this one holds; PlacedInstance gates on arranging + not-confirming).
  const [target, setTarget] = useState<ArrangeTarget | null>(null);

  // The nearest-free landing slot for the current target — the hairline (design §8). Recomputes only when
  // the target, the committed instances, or the column count change; during a gesture `instances` is stable
  // (the one commit fires on END), so this tracks the finger, not React churn. Null while idle keeps the
  // common (Glance/wall) path allocation-free.
  const activeSlot = useMemo(
    () => (target ? placeActive(instances, target, columns) : null),
    [target, instances, columns],
  );

  const onArrangeMove = useCallback((instanceId: string, slot: GridRect) => {
    setTarget({ instanceId, slot });
  }, []);

  const onArrangeEnd = useCallback(
    (instanceId: string, slot: GridRect): GridRect => {
      const target = { instanceId, slot };
      // The nearest-free landing the hairline showed (design §8) IS where the card must SETTLE — never on a
      // neighbour. Returned unconditionally so the gesture host redirects its optimistic raw-finger settle to
      // this slot; on a no-op drop it equals the card's own origin, so the card animates back rather than
      // stranding on the card it was dropped onto (the raw-finger vs nearest-free mismatch the review found).
      const landing = placeActive(instances, target, columns);
      // Place, don't pack: commit ONLY the active card at that landing (against the committed instances,
      // unchanged since the gesture began, + the FINAL slot). A true in-place drop, or a card that did not
      // move, yields null and writes nothing — no neighbour ever moves, so a pre-existing gap (e.g. a removed
      // widget's hole; useRemoveWidget does not compact) is preserved. activeCommit re-derives the same
      // landing, so the committed rect and the returned settle target can never diverge.
      const c = activeCommit(instances, target, columns);
      if (c) commit(c.instanceId, c.patch);
      setTarget(null);
      return landing;
    },
    [instances, commit, columns],
  );

  const onArrangeCancel = useCallback(() => setTarget(null), []);

  // Neighbours never move under place-don't-pack, so no card is ever driven by a preview: always null. The
  // active card is driven by its own gesture (finger for drag, live footprint for resize) regardless.
  const previewFor = useCallback((): LayoutRect | null => null, []);

  return {
    activeId: target?.instanceId ?? null,
    activeSlot,
    previewFor,
    onArrangeMove,
    onArrangeEnd,
    onArrangeCancel,
  };
}
