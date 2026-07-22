// AOD-140 arrange-session wiring: the JS-thread state between the gesture host (PlacedInstance) and the
// pure orchestration (arrange.ts). renderHook drives the reporters directly — no gesture-handler, no
// reanimated worklet — so this proves exactly what unit tests CAN prove (the commit/preview RESULTS),
// leaving the live-snap FEEL to the device pass (AOD-190). It asserts: a move opens a preview for the
// neighbours (but never for the active card), an end commits every moved card once and clears the
// session, and a cancel commits nothing.
import { act, renderHook } from '@testing-library/react-native';
import type { LayoutRect, WidgetInstance } from '../../registry/types';
import { useArrangeReflow } from '../useArrangeReflow';

const rect = (x: number, y: number, w: number, h: number, z = 0): LayoutRect => ({ x, y, w, h, z });
function inst(id: string, r: LayoutRect, size: WidgetInstance['size'] = 'S'): WidgetInstance {
  return { instanceId: id, serviceId: 'stub', widgetType: 'w', config: {}, rect: r, size };
}

const A = inst('A', rect(0, 0, 1, 1));
const B = inst('B', rect(1, 0, 1, 1));
// C sits at the reading-order-compact slot AFTER A and B on the 6-col landscape grid (col2, row0), so a
// reflow that shuffles A/B leaves C put — the "unchanged neighbour" the commit tests turn on (AOD-197).
const C = inst('C', rect(2, 0, 1, 1));

describe('useArrangeReflow', () => {
  it('is inert until a gesture moves (no active id, no slot, no preview)', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B, C], commit));
    expect(result.current.activeId).toBeNull();
    expect(result.current.activeSlot).toBeNull();
    expect(result.current.previewFor('A')).toBeNull();
    expect(commit).not.toHaveBeenCalled();
  });

  it('a move opens the hairline slot and a reflow preview for the neighbours, not the active card', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B, C], commit));

    act(() => result.current.onArrangeMove('B', { x: 0, y: 0, w: 1, h: 1 }));

    expect(result.current.activeId).toBe('B');
    expect(result.current.activeSlot).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    // The active card follows its own gesture -> no preview for it.
    expect(result.current.previewFor('B')).toBeNull();
    // Neighbours get their reflowed slots (B pinned at 0,0 packs A to col1; C stays put at col2, row 0).
    expect(result.current.previewFor('A')).toEqual(rect(1, 0, 1, 1));
    expect(result.current.previewFor('C')).toEqual(rect(2, 0, 1, 1));
    expect(commit).not.toHaveBeenCalled(); // nothing persists mid-gesture
  });

  it('end commits the dragged card + every displaced neighbour ONCE, then clears the session', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B, C], commit));

    act(() => result.current.onArrangeMove('B', { x: 0, y: 0, w: 1, h: 1 }));
    act(() => result.current.onArrangeEnd('B', { x: 0, y: 0, w: 1, h: 1 }));

    // B moved (1,0)->(0,0); A moved (0,0)->(1,0); C unchanged -> not committed.
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledWith('B', { rect: rect(0, 0, 1, 1), size: 'S' });
    expect(commit).toHaveBeenCalledWith('A', { rect: rect(1, 0, 1, 1), size: 'S' });
    expect(commit).not.toHaveBeenCalledWith('C', expect.anything());
    // Session cleared.
    expect(result.current.activeId).toBeNull();
    expect(result.current.previewFor('A')).toBeNull();
  });

  it('end after a RESIZE commits the live-snapped size (footprint -> S/M/W/L)', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B], commit));
    act(() => result.current.onArrangeEnd('A', { x: 0, y: 0, w: 2, h: 2 }));
    expect(commit).toHaveBeenCalledWith('A', { rect: rect(0, 0, 2, 2), size: 'L' });
    expect(commit).toHaveBeenCalledWith('B', { rect: rect(2, 0, 1, 1), size: 'S' }); // packed beside the L (col2)
  });

  it('cancel commits nothing and clears the preview', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B, C], commit));
    act(() => result.current.onArrangeMove('B', { x: 0, y: 0, w: 1, h: 1 }));
    act(() => result.current.onArrangeCancel());
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.activeId).toBeNull();
    expect(result.current.previewFor('A')).toBeNull();
  });

  it('an in-place drop (target == current slot, stable layout) commits nothing', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B], commit));
    act(() => result.current.onArrangeEnd('A', { x: 0, y: 0, w: 1, h: 1 }));
    expect(commit).not.toHaveBeenCalled();
  });

  it('an in-place drop on a board with a pre-existing gap commits NOTHING (no surprise compaction)', () => {
    // D sits at row 1 with (1,0) empty above it — a reading-order gap grid.reflow WOULD compact. A no-move
    // drop of A must not trigger that: tapping a card and releasing never makes other cards jump (the
    // from:dogfood pain). Without the in-place guard this reflows D up to (1,0) and commits it.
    const commit = jest.fn();
    const D = inst('D', rect(0, 1, 1, 1));
    const { result } = renderHook(() => useArrangeReflow([A, D], commit));
    act(() => result.current.onArrangeEnd('A', { x: 0, y: 0, w: 1, h: 1 }));
    expect(commit).not.toHaveBeenCalled();
  });
});
