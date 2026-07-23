// AOD-197 (S4) + AOD-196 (S5) component band: LayoutCanvas' fit-to-width scale layer and the handheld vertical
// SCROLL container. The gesture FEEL + the nearest-free math are covered elsewhere (PlacedInstance.test,
// arrange.test, useArrangeReflow.test); this guards the STRUCTURAL contracts: the handheld canvas (cellPx
// given) wraps the nominal grid in a top-left scale layer INSIDE a gesture-handler ScrollView whose content
// carries an explicit height = contentRows x cellPx (+ bottom inset), while the wall (cellPx absent) renders
// with NO ScrollView and NO wrapper so its path stays byte-identical (KioskWall applies its own wallFitScale
// around the whole canvas, and the wall never scrolls — design §7).
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import type { WidgetInstance } from '../../registry/types';
import { UNIT_PX } from '../geometry';

// gesture-handler: GestureDetector renders its child; each Gesture is a no-op chainable (worklets never fire
// under jest, so the snap/place logic is tested purely — arrange.test / useArrangeReflow.test).
// `blocksExternalGesture` is in the chainable list (AOD-196: PlacedInstance wires it when a scrollRef is
// handed down), and ScrollView is a passthrough View so the handheld scroll container renders its content.
jest.mock('react-native-gesture-handler', () => {
  const RN = require('react-native');
  const ReactLocal = require('react');
  const make = () => {
    const g: Record<string, () => unknown> = {};
    ['enabled', 'minDuration', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'onBegin', 'onChange', 'blocksExternalGesture'].forEach((m) => {
      g[m] = () => g;
    });
    return g;
  };
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pan: make, LongPress: make },
    ScrollView: ({ children, testID, onLayout }: { children?: React.ReactNode; testID?: string; onLayout?: unknown }) =>
      ReactLocal.createElement(RN.View, { testID, onLayout }, children),
  };
});
jest.mock('../../host/WidgetHost', () => ({ WidgetHost: () => null }));
jest.mock('../../registry/RegistryProvider', () => ({
  useRegistry: () => ({ getWidgetDef: () => ({ supportedSizes: ['S', 'W', 'L'] }) }),
}));

import { LayoutCanvas } from '../LayoutCanvas';

const noop = () => {};
const inst = (id: string, rect: WidgetInstance['rect'] = { x: 0, y: 0, w: 1, h: 1, z: 0 }): WidgetInstance => ({
  instanceId: id,
  serviceId: 'stub',
  widgetType: 'w',
  config: {},
  rect,
  size: 'S',
});

function renderCanvas(props: Partial<React.ComponentProps<typeof LayoutCanvas>> = {}) {
  return render(
    <LayoutCanvas
      instances={[inst('a')]}
      arranging={false}
      onEnterArrange={noop}
      onExitArrange={noop}
      onCommit={noop}
      onRequestConfigure={noop}
      onRemove={noop}
      {...props}
    />,
  );
}

describe('LayoutCanvas fit-to-width scale layer (AOD-197 S4)', () => {
  it('wraps the grid in a top-left scale layer (scale = cellPx / UNIT_PX) when cellPx is given (handheld)', () => {
    renderCanvas({ cellPx: 48, columns: 4 });
    const layer = screen.getByTestId('layout-scale-layer');
    const style = StyleSheet.flatten(layer.props.style);
    expect(style.transform).toEqual([{ scale: 48 / UNIT_PX }]); // 48 / 96 = 0.5
    expect(style.transformOrigin).toBe('left top');
  });

  it('renders NO scale layer when cellPx is absent (the wall path stays byte-identical)', () => {
    renderCanvas(); // no cellPx -> nominal, exactly as pre-AOD-197
    expect(screen.queryByTestId('layout-scale-layer')).toBeNull();
  });

  it('scales by the ORIENTATION cell (a smaller portrait/handheld cellPx gives a smaller scale)', () => {
    renderCanvas({ cellPx: 24 });
    const style = StyleSheet.flatten(screen.getByTestId('layout-scale-layer').props.style);
    expect((style.transform as Array<{ scale: number }>)[0].scale).toBeCloseTo(24 / UNIT_PX);
  });

  it('mounts a scaled ARRANGE canvas with no hairline at rest (no active gesture -> no landing slot)', () => {
    renderCanvas({ cellPx: 60, columns: 6, arranging: true });
    expect(screen.getByTestId('layout-scale-layer')).toBeTruthy();
    expect(screen.queryByTestId('arrange-hairline-slot')).toBeNull();
  });

  // AOD-198 (item 1): an outer margin insets the scale layer by gridInsetPx on BOTH axes (translate is
  // OUTERMOST, so it shifts the whole scaled grid by gridInsetPx SCREEN px), balancing the margin cellPx
  // already reserves off both sides — the grid no longer hugs the left with all the slack on the right.
  it('translates the scale layer by gridInsetPx on both axes when a margin is given (AOD-198 item 1)', () => {
    renderCanvas({ cellPx: 48, columns: 6, gridInsetPx: 24 });
    const style = StyleSheet.flatten(screen.getByTestId('layout-scale-layer').props.style);
    expect(style.transform).toEqual([{ translateX: 24 }, { translateY: 24 }, { scale: 48 / UNIT_PX }]);
  });

  it('keeps the bare scale (no translate) when no margin is given (byte-identical to pre-AOD-198)', () => {
    renderCanvas({ cellPx: 48, columns: 6 }); // no gridInsetPx
    const style = StyleSheet.flatten(screen.getByTestId('layout-scale-layer').props.style);
    expect(style.transform).toEqual([{ scale: 48 / UNIT_PX }]);
  });
});

// AOD-195 (sub-decision 6b): the calm menu-driven delete threads confirmingRemoveId down to the matching card,
// which shows the AOD-141 tile-face confirm WITHOUT arranging. Only the id that matches confirms; the wall
// (no confirmingRemoveId) never does.
describe('LayoutCanvas menu-driven delete confirm (AOD-195)', () => {
  it('shows the confirm face on the calm card whose id matches confirmingRemoveId (no arrange)', () => {
    renderCanvas({ instances: [inst('a'), inst('b')], cellPx: 48, columns: 6, confirmingRemoveId: 'a' });
    expect(screen.getByTestId('remove-confirm-face-a')).toBeTruthy();
    // The non-matching card is untouched, and neither card shows arrange chrome (we never entered Arrange).
    expect(screen.queryByTestId('remove-confirm-face-b')).toBeNull();
    expect(screen.queryByTestId('configure-a')).toBeNull();
  });

  it('shows no confirm face when confirmingRemoveId is absent (the wall / calm rest state)', () => {
    renderCanvas({ instances: [inst('a')], cellPx: 48, columns: 6 });
    expect(screen.queryByTestId('remove-confirm-face-a')).toBeNull();
  });
});

// AOD-196 (S5): the handheld canvas is a VERTICAL scroll container whose content carries an EXPLICIT layout
// height = contentRows x cellPx (the VISUAL height — a transform scales the grid but never changes its layout
// height, so a naive ScrollView would measure the nominal, too-tall extent) plus the bottom safe-area inset;
// the wall (cellPx absent) renders NO scroll container and never scrolls.
describe('LayoutCanvas vertical scroll container (AOD-196 S5)', () => {
  afterEach(() => {
    // Reset the shared mock insets so a set-inset case never leaks into the next test.
    Object.assign(UnistylesRuntime.insets, { top: 0, left: 0, right: 0, bottom: 0 });
  });

  it('wraps the handheld canvas in a scroll container (cellPx given)', () => {
    renderCanvas({ cellPx: 48, columns: 4 });
    expect(screen.getByTestId('layout-scroll')).toBeTruthy();
    expect(screen.getByTestId('layout-scroll-content')).toBeTruthy();
  });

  it('the scroll content carries the VISUAL layout height = contentRows x cellPx for a tall board', () => {
    // A card at row 3 spanning 2 rows -> contentRows = 3 + 2 = 5; the visual height is 5 x cellPx, NOT the
    // nominal 5 x UNIT_PX (that would over-scroll by the fit-to-width factor). Insets default to 0 here.
    renderCanvas({ instances: [inst('a', { x: 0, y: 3, w: 1, h: 2, z: 0 })], cellPx: 48, columns: 6 });
    const content = screen.getByTestId('layout-scroll-content');
    const style = StyleSheet.flatten(content.props.style);
    expect(style.height).toBe(5 * 48); // 240, the on-screen (scaled) height — not 5 * UNIT_PX (480)
  });

  it('floors the content height at 1 row for an empty board (never collapses)', () => {
    // Empty instances -> contentRows = max(1, ...[]) = 1, so a bare board still carries one cell of height
    // (the measured-viewport floor lifts it further on device; onLayout does not fire under jest).
    renderCanvas({ instances: [], cellPx: 50, columns: 6 });
    const style = StyleSheet.flatten(screen.getByTestId('layout-scroll-content').props.style);
    expect(style.height).toBe(1 * 50);
  });

  it('reserves the bottom safe-area inset so the deepest row clears the nav bar', () => {
    Object.assign(UnistylesRuntime.insets, { bottom: 48 });
    renderCanvas({ instances: [inst('a', { x: 0, y: 0, w: 1, h: 1, z: 0 })], cellPx: 50, columns: 6 });
    const style = StyleSheet.flatten(screen.getByTestId('layout-scroll-content').props.style);
    expect(style.height).toBe(1 * 50 + 48); // contentRows x cellPx + insets.bottom
  });

  // AOD-198: with gutters each unit-row occupies a cell PLUS its gutter (the pitch cellPx + gutterPx), and the
  // grid is inset from the top by gridInsetPx (item 1). The scroll height reserves both (+ the bottom inset)
  // so the deepest GAPPED row still clears the nav bar; the wall never scrolls, so it never takes this path.
  it('reserves the vertical gutter (pitch) + the top inset in the scroll height (AOD-198)', () => {
    // A card at row 3 spanning 2 rows -> contentRows = 5; pitch = 50 + 24 = 74; top inset 24; bottom 0.
    renderCanvas({
      instances: [inst('a', { x: 0, y: 3, w: 1, h: 2, z: 0 })],
      cellPx: 50,
      gutterPx: 24,
      gridInsetPx: 24,
      columns: 6,
    });
    const style = StyleSheet.flatten(screen.getByTestId('layout-scroll-content').props.style);
    expect(style.height).toBe(5 * (50 + 24) + 24); // contentRows x pitch + gridInsetPx
  });

  it('renders NO scroll container on the wall (cellPx absent) — the wall never scrolls (byte-identical)', () => {
    renderCanvas(); // wall path: no cellPx
    expect(screen.queryByTestId('layout-scroll')).toBeNull();
    expect(screen.queryByTestId('layout-scroll-content')).toBeNull();
  });
});
