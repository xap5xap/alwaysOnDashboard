// AOD-197 (S4) component band: LayoutCanvas' fit-to-width scale layer. The gesture FEEL + the nearest-free
// math are covered elsewhere (PlacedInstance.test, arrange.test, useArrangeReflow.test); this guards the ONE
// structural contract S4 adds — the handheld canvas (cellPx given) wraps the nominal grid in a top-left
// scale layer so cells fill the screen width, while the wall (cellPx absent) renders with NO wrapper so its
// path stays byte-identical (KioskWall applies its own wallFitScale around the whole canvas).
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { WidgetInstance } from '../../registry/types';
import { UNIT_PX } from '../geometry';

// gesture-handler: GestureDetector renders its child; each Gesture is a no-op chainable (worklets never fire
// under jest, so the snap/place logic is tested purely — arrange.test / useArrangeReflow.test).
jest.mock('react-native-gesture-handler', () => {
  const make = () => {
    const g: Record<string, () => unknown> = {};
    ['enabled', 'minDuration', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'onBegin', 'onChange'].forEach((m) => {
      g[m] = () => g;
    });
    return g;
  };
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pan: make, LongPress: make },
  };
});
jest.mock('../../host/WidgetHost', () => ({ WidgetHost: () => null }));
jest.mock('../../registry/RegistryProvider', () => ({
  useRegistry: () => ({ getWidgetDef: () => ({ supportedSizes: ['S', 'W', 'L'] }) }),
}));

import { LayoutCanvas } from '../LayoutCanvas';

const noop = () => {};
const inst = (id: string): WidgetInstance => ({
  instanceId: id,
  serviceId: 'stub',
  widgetType: 'w',
  config: {},
  rect: { x: 0, y: 0, w: 1, h: 1, z: 0 },
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
});
