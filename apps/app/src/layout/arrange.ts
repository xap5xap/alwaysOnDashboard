// The pure arrange-session orchestration (AOD-140, resolves AOD-98): given an in-progress drag/resize
// and the committed board, compute where the active card lands and whether it must be persisted on drop.
// This is the INSTANCE-level layer above the registry-free slot ALGEBRA in grid.ts: it knows
// WidgetInstance + LayoutPatch, grid.ts only knows GridRect. Keeping it pure (no React, no I/O) is what
// makes the WYSIWYG contract unit-testable — the gesture FEEL is device (AOD-190), but the snap/place/commit
// RESULTS are asserted here and consumed by useArrangeReflow.
//
// AOD-197 (S4) "place, don't pack" (design §8): a move relocates ONLY the active card, gaps preserved. The
// active card lands at the NEAREST FREE fitting slot (grid.nearestFreeSlot) computed against every OTHER
// card — placeActive + activeCommit. The pre-AOD-197 neighbour PACK (reflowForTarget + collectArrangeCommits,
// which pinned the active card and re-packed the rest via grid.reflow) is NO LONGER CALLED by the live path;
// it is left here as dead code for AOD-192 (S8) to prune once nothing references it.
import type { LayoutRect, WidgetInstance } from '../registry/types';
import { slotIdFor } from '../widgets/sizes';
import { type GridRect, nearestFreeSlot, reflow } from './grid';
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

// --- AOD-197 (S4) place, don't pack (design §8) ----------------------------------------------------
// The live arrange path from here down. Only the ACTIVE card ever moves; every other card holds its
// committed slot (gaps preserved). Pure, like the pack pair above, so the WYSIWYG result is unit-tested.

/** The cell a card currently occupies (origin + footprint), for the occupancy scan. */
function cellOf(rect: LayoutRect): GridRect {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

/**
 * Where the actively dragged/resized card lands under "place, don't pack" (design §8): the NEAREST FREE
 * fitting slot to the gesture's target, computed against every OTHER card (the active card is excluded from
 * the occupancy, so it never collides with itself). Neighbours never move — only this card relocates, so
 * gaps are preserved. If the target cell is free it wins outright (WYSIWYG: the card lands where the finger
 * is); if it is occupied (a drop onto another card, or a resize whose grown footprint would overlap), the
 * card nudges to the nearest free cell that fits its footprint (grid.nearestFreeSlot). Pure; both the live
 * hairline (useArrangeReflow.activeSlot) and the drop commit read it, so what the hairline shows IS what
 * persists. `columns` is the active orientation's count.
 */
export function placeActive(
  instances: WidgetInstance[],
  target: ArrangeTarget,
  columns: number,
): GridRect {
  const occupied = instances
    .filter((i) => i.instanceId !== target.instanceId)
    .map((i) => cellOf(i.rect));
  return nearestFreeSlot(
    { w: target.slot.w, h: target.slot.h },
    occupied,
    { x: target.slot.x, y: target.slot.y },
    columns,
  );
}

/**
 * The single commit for a finished place-don't-pack gesture: the active card at its nearest-free landing
 * (placeActive), or null when the card is unchanged (a true in-place drop) or missing. Only ever ONE card
 * commits — neighbours are never touched — so a tap-and-release, or a drop back onto the same slot, writes
 * nothing and no other card jumps (the from:dogfood arrange pain). The size is derived from the landed
 * footprint (slotIdFor); the active card's z is preserved.
 */
export function activeCommit(
  instances: WidgetInstance[],
  target: ArrangeTarget,
  columns: number,
): ArrangeCommit | null {
  const active = instances.find((i) => i.instanceId === target.instanceId);
  if (!active) return null;
  const slot = placeActive(instances, target, columns);
  const c = active.rect;
  if (slot.x === c.x && slot.y === c.y && slot.w === c.w && slot.h === c.h) return null; // in-place: no write
  const rect: LayoutRect = { x: slot.x, y: slot.y, w: slot.w, h: slot.h, z: c.z };
  return { instanceId: active.instanceId, patch: { rect, size: slotIdFor(slot.w, slot.h) } };
}
