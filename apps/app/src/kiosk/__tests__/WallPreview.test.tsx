// AOD-81 §6 the wall preview: the true wall render of the draft, mounted for a peek, dismissed on tap/back,
// with NONE of the AOD-11 runtime guard. Rendered with an empty draft so the assertions are about what
// WallPreview OWNS (the scale layer / dismiss / the not-the-kiosk boundary), not LayoutCanvas/PlacedInstance
// (tested elsewhere and needing the registry). The 1.4x scale layer IS the §3 window: field + overflow hidden
// + scale wall.typeScale = screen / typeScale, the same window the boundary box draws.
import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { darkTheme } from '../../../unistyles';
import { WallPreview } from '../WallPreview';

describe('WallPreview §6', () => {
  it('mounts the wall scale layer at wall.typeScale, anchored top-left (the §3 window)', () => {
    render(<WallPreview instances={[]} onClose={jest.fn()} />);
    expect(screen.getByTestId('wall-preview')).toBeTruthy();
    const layer = StyleSheet.flatten(screen.getByTestId('wall-preview-scale-layer').props.style);
    expect(layer.transform).toEqual([{ scale: darkTheme.wall.typeScale }]); // the same 1.4x the wall applies
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
