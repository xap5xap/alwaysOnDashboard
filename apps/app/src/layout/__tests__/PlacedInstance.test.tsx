// AOD-140 component band: PlacedInstance rendered standalone. The live-snap gesture FEEL is device-only
// (AOD-190) and the commit/reflow RESULTS are covered purely (arrange.test / useArrangeReflow.test), so
// this test guards the OTHER contract line — "preserve every AOD-141 affordance" — while the gesture host
// was rewritten. gesture-handler is stubbed to a passthrough (the real one needs reanimated's native
// event system, absent under jest — see the repo's manual reanimated mock), WidgetHost is stubbed to keep
// the card free of the data/provider stack, and useRegistry is stubbed for supportedSizes. What renders is
// PlacedInstance's own arrange chrome: the Configure/Remove pills, the 44pt resize handle, and the
// two-step "Remove?" confirm face.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { WidgetInstance } from '../../registry/types';

// gesture-handler: GestureDetector renders its child; each Gesture is a no-op chainable (the worklets
// never fire under jest, which is why the snap/commit logic is tested purely, not through the gesture).
// `blocksExternalGesture` records its argument (AOD-196: a scrollRef, so a card drag/resize BLOCKS the
// handheld canvas scroll) so the wiring is assertable at the logic level; it still returns the gesture so
// the chain holds.
const mockBlocksExternal = jest.fn();
jest.mock('react-native-gesture-handler', () => {
  const make = () => {
    const g: Record<string, (...args: unknown[]) => unknown> = {};
    ['enabled', 'minDuration', 'onStart', 'onUpdate', 'onEnd', 'onFinalize', 'onBegin', 'onChange'].forEach((m) => {
      g[m] = () => g;
    });
    g.blocksExternalGesture = (...args: unknown[]) => {
      mockBlocksExternal(...args);
      return g;
    };
    return g;
  };
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pan: make, LongPress: make },
  };
});

// WidgetHost pulls the whole data/provider stack; the affordance tests don't need it. Stub to nothing.
jest.mock('../../host/WidgetHost', () => ({ WidgetHost: () => null }));

// The registry lookup only feeds supportedSizes here.
jest.mock('../../registry/RegistryProvider', () => ({
  useRegistry: () => ({ getWidgetDef: () => ({ supportedSizes: ['S', 'W', 'L'] }) }),
}));

import { PlacedInstance } from '../PlacedInstance';

const instance: WidgetInstance = {
  instanceId: 'card-1',
  serviceId: 'stub',
  widgetType: 'w',
  config: {},
  rect: { x: 0, y: 0, w: 1, h: 1, z: 0 },
  size: 'S',
};

function renderCard(props: Partial<React.ComponentProps<typeof PlacedInstance>> = {}) {
  const onRemove = jest.fn();
  const onRequestConfigure = jest.fn();
  const utils = render(
    <PlacedInstance
      instance={instance}
      arranging
      onLongPress={jest.fn()}
      previewRect={null}
      onArrangeMove={jest.fn()}
      onArrangeEnd={jest.fn()}
      onArrangeCancel={jest.fn()}
      onRequestConfigure={onRequestConfigure}
      onRemove={onRemove}
      {...props}
    />,
  );
  return { ...utils, onRemove, onRequestConfigure };
}

describe('PlacedInstance arrange affordances (AOD-141 preserved through the AOD-140 rewrite)', () => {
  it('renders the Configure + Remove pills and the resize handle while arranging', () => {
    renderCard();
    expect(screen.getByTestId('configure-card-1')).toBeTruthy();
    expect(screen.getByTestId('remove-card-1')).toBeTruthy();
    expect(screen.getByLabelText('Resize widget')).toBeTruthy();
  });

  it('shows NO arrange chrome when not arranging', () => {
    renderCard({ arranging: false });
    expect(screen.queryByTestId('configure-card-1')).toBeNull();
    expect(screen.queryByTestId('remove-card-1')).toBeNull();
    expect(screen.queryByLabelText('Resize widget')).toBeNull();
  });

  it('Configure fires onRequestConfigure with the instance', () => {
    const { onRequestConfigure } = renderCard();
    fireEvent.press(screen.getByTestId('configure-card-1'));
    expect(onRequestConfigure).toHaveBeenCalledWith(instance);
  });

  it('Remove is two-step: it opens the in-place confirm face (it does not delete)', () => {
    const { onRemove } = renderCard();
    fireEvent.press(screen.getByTestId('remove-card-1'));
    expect(screen.getByTestId('remove-confirm-face-card-1')).toBeTruthy();
    // The pills yield to the confirm face; no deletion yet.
    expect(screen.queryByTestId('configure-card-1')).toBeNull();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('confirming the face deletes; Keep reverts to the pills without deleting', () => {
    const { onRemove } = renderCard();

    // Keep path.
    fireEvent.press(screen.getByTestId('remove-card-1'));
    fireEvent.press(screen.getByTestId('remove-keep-card-1'));
    expect(screen.getByTestId('configure-card-1')).toBeTruthy(); // back to the pills
    expect(onRemove).not.toHaveBeenCalled();

    // Confirm path.
    fireEvent.press(screen.getByTestId('remove-card-1'));
    fireEvent.press(screen.getByTestId('remove-confirm-card-1'));
    expect(onRemove).toHaveBeenCalledWith('card-1');
  });

  it('renders a neighbour driven by a previewRect without crashing (the reflow target path)', () => {
    renderCard({ previewRect: { x: 1, y: 0, w: 1, h: 1, z: 0 } });
    // Still a live arrange card with its chrome; the preview only drives the animated position.
    expect(screen.getByTestId('configure-card-1')).toBeTruthy();
  });

  it('accepts the AOD-197 (S4) cellPx + columns (portrait) and keeps its arrange chrome', () => {
    // The fit-to-width scale lives on the LayoutCanvas PARENT; the card takes cellPx + columns only to feed
    // its gesture worklets (finger px / cellPx, clamp x by columns) — that math is asserted purely in
    // geometry.test (snapDrag), since the worklets never fire under jest. Here we prove the props
    // are wired and every affordance survives in a portrait (4-col, smaller cellPx) mount; the RENDER stays on
    // the nominal UNIT_PX (unchanged), so the card is orientation-independent and the parent scale sizes it.
    renderCard({ cellPx: 48, columns: 4 });
    expect(screen.getByTestId('configure-card-1')).toBeTruthy();
    expect(screen.getByTestId('remove-card-1')).toBeTruthy();
    expect(screen.getByLabelText('Resize widget')).toBeTruthy();
  });
});

// AOD-195 (sub-decision 6b): the calm long-press menu's Delete reuses the AOD-141 tile-face "Remove?" confirm,
// rendered on the card WITHOUT entering Arrange. The dashboard drives it via menuConfirmingRemove (true for the
// card whose id it is confirming); Confirm fires onRemove, Keep fires onCancelMenuRemove (clearing the
// dashboard-owned state), and NO arrange chrome ever appears.
describe('menu-driven delete outside Arrange (AOD-195)', () => {
  it('shows the confirm face on the calm card (no arrange chrome) when menuConfirmingRemove is set', () => {
    renderCard({ arranging: false, menuConfirmingRemove: true });
    expect(screen.getByTestId('remove-confirm-face-card-1')).toBeTruthy();
    // We never entered Arrange, so there are no pills / resize handle behind it.
    expect(screen.queryByTestId('configure-card-1')).toBeNull();
    expect(screen.queryByTestId('remove-card-1')).toBeNull();
    expect(screen.queryByLabelText('Resize widget')).toBeNull();
  });

  it('Confirm fires onRemove; Keep clears via onCancelMenuRemove (not the local arrange reset)', () => {
    const onCancelMenuRemove = jest.fn();
    const { onRemove } = renderCard({ arranging: false, menuConfirmingRemove: true, onCancelMenuRemove });

    // Keep routes to the dashboard's clear, and does NOT delete.
    fireEvent.press(screen.getByTestId('remove-keep-card-1'));
    expect(onCancelMenuRemove).toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();

    // Confirm deletes (the face stays mounted here because the prop is static in this isolated mount; in the
    // app the dashboard clears confirmingRemoveId, unmounting it).
    fireEvent.press(screen.getByTestId('remove-confirm-card-1'));
    expect(onRemove).toHaveBeenCalledWith('card-1');
  });
});

// AOD-196 (S5): on the handheld canvas a scroll container is present, so a card's drag + resize must BLOCK it
// (blocksExternalGesture) — a vertical pan starting on the card drags/resizes it instead of scrolling. On the
// wall there is no ScrollView (no scrollRef), so the gesture config stays byte-identical (no block wired).
describe('scroll-vs-drag arbitration (AOD-196)', () => {
  beforeEach(() => mockBlocksExternal.mockClear());

  it('wires the drag + resize to BLOCK the canvas scroll when a scrollRef is provided', () => {
    const scrollRef = React.createRef<React.ComponentType>();
    renderCard({ scrollRef: scrollRef as React.ComponentProps<typeof PlacedInstance>['scrollRef'] });
    // Both the drag and the resize Pan block the scroll (so a pan that starts on the card wins over it).
    expect(mockBlocksExternal).toHaveBeenCalledTimes(2);
    expect(mockBlocksExternal).toHaveBeenCalledWith(scrollRef);
  });

  it('does NOT block any external gesture on the wall (no scrollRef -> byte-identical gesture config)', () => {
    renderCard(); // no scrollRef
    expect(mockBlocksExternal).not.toHaveBeenCalled();
  });
});
