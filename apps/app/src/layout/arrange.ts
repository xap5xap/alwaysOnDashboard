// The pure arrange-session orchestration (AOD-140, resolves AOD-98): given an in-progress drag/resize
// and the committed board, compute where every card lands (the live reflow preview) and which cards must
// be persisted on drop (the commit set). This is the INSTANCE-level layer above the registry-free slot
// ALGEBRA in grid.ts: it knows WidgetInstance + LayoutPatch, grid.ts only knows GridRect. Keeping it pure
// (no React, no I/O) is what makes the WYSIWYG contract unit-testable — the gesture FEEL is device
// (AOD-190), but the snap/reflow/commit RESULTS are asserted here and consumed by useArrangeReflow.
//
// The overlap-free guarantee is inherited whole from grid.reflow (AOD-138): pin the dragged card at its
// live target slot, re-pack the rest in reading order. This module never re-derives that math; it only
// zips the pure result back onto the instances and diffs it against the committed layout.
import type { LayoutRect, WidgetInstance } from '../registry/types';
import { slotIdFor } from '../widgets/sizes';
import { type GridRect, reflow } from './grid';
import type { LayoutPatch } from './mapper';

/**
 * The live target of an in-progress arrange gesture: the card being moved/resized and the slot it will
 * land on (origin + footprint, w/h in {1,2}). A drag reports a new ORIGIN each time it crosses a grid
 * boundary (footprint unchanged); a resize reports a new FOOTPRINT each time it flips S/M/W/L. The slot is
 * already snapped + clamped by the gesture (PlacedInstance), so reflow's own clamp is idempotent over it.
 */
export interface ArrangeTarget {
  instanceId: string;
  slot: GridRect;
}

/** One card to persist at gesture end: the reflowed rect + the size id its footprint occupies. */
export interface ArrangeCommit {
  instanceId: string;
  patch: LayoutPatch;
}

/**
 * Reflow the whole board around an in-progress gesture. Places the active card at its live target slot
 * (footprint from the gesture, z preserved), pins it, and re-packs every neighbour in reading order via
 * grid.reflow — so the returned layout is overlap-free by construction (AOD-138's headline invariant).
 * Returns a Map instanceId -> reflowed LayoutRect covering EVERY instance, in which the active card maps
 * to its clamped target slot and each neighbour to its packed slot. The neighbour animation (LayoutCanvas
 * -> PlacedInstance) and the commit set (collectArrangeCommits) both read this one Map, so the preview a
 * user sees and the layout that persists are the same computation — no drift, no felt snap on release.
 *
 * When the active id is not among `instances` (defensive; should not happen), grid.reflow's own guard
 * returns the rects untouched, so this yields the committed layout unchanged (nothing to pin, nothing to
 * move) and collectArrangeCommits then finds no changes.
 */
export function reflowForTarget(
  instances: WidgetInstance[],
  target: ArrangeTarget,
): Map<string, LayoutRect> {
  const pinnedIndex = instances.findIndex((i) => i.instanceId === target.instanceId);
  const rects: LayoutRect[] = instances.map((i) =>
    i.instanceId === target.instanceId
      ? { ...i.rect, x: target.slot.x, y: target.slot.y, w: target.slot.w, h: target.slot.h }
      : i.rect,
  );
  const out = reflow(rects, pinnedIndex);
  const map = new Map<string, LayoutRect>();
  instances.forEach((instance, index) => map.set(instance.instanceId, out[index]));
  return map;
}

/**
 * The commit set for a finished gesture: a LayoutPatch for EVERY instance whose slot (x/y/w/h) changed
 * versus its committed rect — the dragged card AND every neighbour the reflow displaced. A card whose
 * reflowed rect equals its committed rect yields no patch, so an in-place drop (or an undisturbed
 * neighbour) never writes. The size is derived straight from the reflowed footprint (slotIdFor): after a
 * reflow every rect is a legal slot, and the active card only ever snaps to a SUPPORTED footprint
 * (PlacedInstance's resize) while neighbours never change footprint — so the derived id is always a size
 * the widget supports (no reconcileSize search needed here). Order follows `instances`; the caller fires
 * the per-instance optimistic+debounced commit for each (calling N times is fine, useDashboard coalesces).
 */
export function collectArrangeCommits(
  instances: WidgetInstance[],
  reflowed: Map<string, LayoutRect>,
): ArrangeCommit[] {
  const commits: ArrangeCommit[] = [];
  for (const instance of instances) {
    const rect = reflowed.get(instance.instanceId);
    if (!rect) continue;
    const c = instance.rect;
    if (rect.x === c.x && rect.y === c.y && rect.w === c.w && rect.h === c.h) continue; // unchanged
    commits.push({ instanceId: instance.instanceId, patch: { rect, size: slotIdFor(rect.w, rect.h) } });
  }
  return commits;
}
