// AOD-81 the wall preview: the true wall render of the draft, mounted for a peek, dismissed on tap/back, with
// NONE of the AOD-11 runtime guard. Rendered with an empty draft so the assertions are about what WallPreview
// OWNS (the auto-fit scale layer / dismiss / the not-the-kiosk boundary), not LayoutCanvas/PlacedInstance
// (tested elsewhere and needing the registry). The scale layer uses the SAME viewport.wallFitScale the wall
// uses, so the preview shows exactly what the wall shows on this device (the fit math is pinned in viewport.test).
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { WallPreview } from '../WallPreview';

describe('WallPreview §6', () => {
  it('mounts an auto-fit scale layer, anchored top-left (the same fit the wall uses)', () => {
    // Empty draft + the mock 0x0 screen -> fit scale 1 (nothing to fit). The fit math itself is pinned in
    // viewport.test.ts; here we only assert the preview wires a computed scale into a top-left scale layer.
    render(<WallPreview instances={[]} onClose={jest.fn()} />);
    expect(screen.getByTestId('wall-preview')).toBeTruthy();
    const layer = StyleSheet.flatten(screen.getByTestId('wall-preview-scale-layer').props.style);
    expect(layer.transform).toEqual([{ scale: 1 }]);
    expect(layer.transformOrigin).toBe('left top');
  });

  it('tap anywhere returns to arranging (onClose)', () => {
    const onClose = jest.fn();
    render(<WallPreview instances={[]} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('wall-preview-dismiss'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is NOT the kiosk: no exit corner, no PIN pad, no hold hint — no runtime guard (§6)', () => {
    render(<WallPreview instances={[]} onClose={jest.fn()} />);
    expect(screen.queryByTestId('kiosk-exit-corner')).toBeNull();
    expect(screen.queryByTestId('kiosk-pin-dots')).toBeNull();
    expect(screen.queryByTestId('kiosk-hold-hint')).toBeNull();
  });
});
