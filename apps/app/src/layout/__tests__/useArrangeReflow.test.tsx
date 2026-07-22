// AOD-197 (S4) arrange-session wiring: the JS-thread state between the gesture host (PlacedInstance) and the
// pure orchestration (arrange.ts), now "place, don't pack" (design §8). renderHook drives the reporters
// directly — no gesture-handler, no reanimated worklet — so this proves exactly what unit tests CAN prove
// (the hairline + commit RESULTS), leaving the live-snap FEEL to the device pass (AOD-190). It asserts: a
// move shows the NEAREST-FREE hairline, a neighbour NEVER gets a preview (previewFor is always null) and
// NEVER commits, a drop persists ONLY the active card at its nearest-free landing, a resize that would
// overlap nudges to the nearest free fit, and a cancel / in-place drop commits nothing.
import { act, renderHook } from '@testing-library/react-native';
import type { LayoutRect, WidgetInstance } from '../../registry/types';
import { useArrangeReflow } from '../useArrangeReflow';

const rect = (x: number, y: number, w: number, h: number, z = 0): LayoutRect => ({ x, y, w, h, z });
function inst(id: string, r: LayoutRect, size: WidgetInstance['size'] = 'S'): WidgetInstance {
  return { instanceId: id, serviceId: 'stub', widgetType: 'w', config: {}, rect: r, size };
}

const A = inst('A', rect(0, 0, 1, 1));
const B = inst('B', rect(1, 0, 1, 1));
const C = inst('C', rect(2, 0, 1, 1));

describe('useArrangeReflow (place, don\'t pack — AOD-197 S4)', () => {
  it('is inert until a gesture moves (no active id, no slot, no preview)', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B, C], commit));
    expect(result.current.activeId).toBeNull();
    expect(result.current.activeSlot).toBeNull();
    expect(result.current.previewFor('A')).toBeNull();
    expect(commit).not.toHaveBeenCalled();
  });

  it('a move to a FREE cell shows the target as the hairline; NO card ever gets a preview', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B, C], commit));

    act(() => result.current.onArrangeMove('B', { x: 3, y: 0, w: 1, h: 1 }));

    expect(result.current.activeId).toBe('B');
    expect(result.current.activeSlot).toEqual({ x: 3, y: 0, w: 1, h: 1 }); // free target wins outright (WYSIWYG)
    // previewFor is ALWAYS null under place-don't-pack: neighbours never move, the active card drives itself.
    expect(result.current.previewFor('A')).toBeNull();
    expect(result.current.previewFor('B')).toBeNull();
    expect(result.current.previewFor('C')).toBeNull();
    expect(commit).not.toHaveBeenCalled(); // nothing persists mid-gesture
  });

  it('a move onto an OCCUPIED cell snaps the hairline to the nearest FREE slot (neighbours never move)', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B, C], commit));

    // Drop B onto A's slot (0,0). A stays put (occupied by others = A@0,0 + C@2,0); B's hairline snaps to the
    // nearest free cell, (1,0) — B's own vacated column — not a neighbour repack.
    act(() => result.current.onArrangeMove('B', { x: 0, y: 0, w: 1, h: 1 }));
    expect(result.current.activeSlot).toEqual({ x: 1, y: 0, w: 1, h: 1 });
    expect(result.current.previewFor('A')).toBeNull(); // A is NOT displaced
    expect(commit).not.toHaveBeenCalled();
  });

  it('end commits ONLY the active card at its (free) target; neighbours are never committed', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B, C], commit));

    // Carry B to a free cell (3,0). B moves; A and C never do, so exactly ONE commit fires.
    act(() => result.current.onArrangeMove('B', { x: 3, y: 0, w: 1, h: 1 }));
    act(() => result.current.onArrangeEnd('B', { x: 3, y: 0, w: 1, h: 1 }));

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('B', { rect: rect(3, 0, 1, 1), size: 'S' });
    expect(commit).not.toHaveBeenCalledWith('A', expect.anything());
    expect(commit).not.toHaveBeenCalledWith('C', expect.anything());
    // Session cleared.
    expect(result.current.activeId).toBeNull();
    expect(result.current.previewFor('A')).toBeNull();
  });

  it('a drop onto an OCCUPIED cell lands the active card at the nearest free slot; neighbours never jump', () => {
    const commit = jest.fn();
    // M carried from far away onto A's slot (0,0). A@0,0 and B@1,0 are occupied, so the nearest free fit is
    // (0,1) — M drops there; A and B keep their slots (no neighbour repack).
    const M = inst('M', rect(4, 0, 1, 1));
    const { result } = renderHook(() => useArrangeReflow([A, B, M], commit));
    act(() => result.current.onArrangeEnd('M', { x: 0, y: 0, w: 1, h: 1 }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('M', { rect: rect(0, 1, 1, 1), size: 'S' });
    expect(commit).not.toHaveBeenCalledWith('A', expect.anything());
    expect(commit).not.toHaveBeenCalledWith('B', expect.anything());
  });

  it('a card dropped into a gap lands there and pulls NO neighbour (gaps preserved)', () => {
    const commit = jest.fn();
    // A at col0, C at col2 — col1 is a gap. Carry A to a free far cell; nothing else moves, the gap stays.
    const { result } = renderHook(() => useArrangeReflow([A, C], commit));
    act(() => result.current.onArrangeEnd('A', { x: 4, y: 0, w: 1, h: 1 }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('A', { rect: rect(4, 0, 1, 1), size: 'S' });
    expect(commit).not.toHaveBeenCalledWith('C', expect.anything()); // C never packs up into the gap
  });

  it('end after a RESIZE that FITS commits the new footprint; the neighbour is untouched', () => {
    const commit = jest.fn();
    // A resized to a W (2x1) at the origin; B sits at col2, so cols 0-1 are free -> the W fits in place.
    const B2 = inst('B', rect(2, 0, 1, 1));
    const { result } = renderHook(() => useArrangeReflow([A, B2], commit));
    act(() => result.current.onArrangeEnd('A', { x: 0, y: 0, w: 2, h: 1 }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('A', { rect: rect(0, 0, 2, 1), size: 'W' });
    expect(commit).not.toHaveBeenCalledWith('B', expect.anything());
  });

  it('a RESIZE whose grown footprint would OVERLAP a neighbour nudges to the nearest free fit (neighbour stays)', () => {
    const commit = jest.fn();
    // A resized to a W (2x1) at the origin, but B sits immediately right at col1 -> a W at (0,0) would cover
    // B's cell. Place-don't-pack skips the overlap by nudging A to the nearest free fitting cell, (0,1); B
    // never moves.
    const { result } = renderHook(() => useArrangeReflow([A, B], commit));
    act(() => result.current.onArrangeEnd('A', { x: 0, y: 0, w: 2, h: 1 }));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('A', { rect: rect(0, 1, 2, 1), size: 'W' });
    expect(commit).not.toHaveBeenCalledWith('B', expect.anything());
  });

  it('clamps the nearest-free scan to the ACTIVE orientation columns (portrait 4 differs from landscape 6)', () => {
    // A lone W (2x1) carried to column 3. Landscape (6 cols): x+2 <= 6, so col3 fits -> the hairline is col3.
    // Portrait (4 cols): x+2 <= 4, so col3 is off-grid and the nearest fitting column is 2.
    const wCard = inst('A', rect(0, 0, 2, 1));
    const land = renderHook(() => useArrangeReflow([wCard], jest.fn(), 6));
    act(() => land.result.current.onArrangeMove('A', { x: 3, y: 0, w: 2, h: 1 }));
    expect(land.result.current.activeSlot).toEqual({ x: 3, y: 0, w: 2, h: 1 });

    const port = renderHook(() => useArrangeReflow([wCard], jest.fn(), 4));
    act(() => port.result.current.onArrangeMove('A', { x: 3, y: 0, w: 2, h: 1 }));
    expect(port.result.current.activeSlot).toEqual({ x: 2, y: 0, w: 2, h: 1 }); // clamped to the 4-col grid
  });

  it('cancel commits nothing and clears the session', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B, C], commit));
    act(() => result.current.onArrangeMove('B', { x: 0, y: 0, w: 1, h: 1 }));
    act(() => result.current.onArrangeCancel());
    expect(commit).not.toHaveBeenCalled();
    expect(result.current.activeId).toBeNull();
    expect(result.current.previewFor('A')).toBeNull();
  });

  it('an in-place drop (target == current slot) commits nothing', () => {
    const commit = jest.fn();
    const { result } = renderHook(() => useArrangeReflow([A, B], commit));
    act(() => result.current.onArrangeEnd('A', { x: 0, y: 0, w: 1, h: 1 }));
    expect(commit).not.toHaveBeenCalled();
  });

  it('an in-place drop on a board with a pre-existing gap commits NOTHING (no surprise compaction)', () => {
    // D sits at row 1 with (0,0) occupied by A and the rest of row 0 empty — a reading-order gap the old
    // grid.reflow WOULD compact. Under place-don't-pack a no-move drop of A touches nothing: only the active
    // card can ever move, and it did not.
    const commit = jest.fn();
    const D = inst('D', rect(0, 1, 1, 1));
    const { result } = renderHook(() => useArrangeReflow([A, D], commit));
    act(() => result.current.onArrangeEnd('A', { x: 0, y: 0, w: 1, h: 1 }));
    expect(commit).not.toHaveBeenCalled();
  });
});
