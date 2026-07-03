// AOD-81 §5 the arrange-mode wall boundary box: the editor's sight of the wall's visible window. It derives
// from the ONE §3 wallViewportUnits helper (viewport.test.ts pins the math); this proves the box draws that
// window in editor px from the origin, tags it device-computed, takes no touch, and always uses the wall's
// LANDSCAPE steady state (not the editor's orientation/insets). The unistyles mock exposes the same mutable
// UnistylesRuntime.screen that useUnistyles returns as rt.screen (the ExitAffordance-test pattern for insets).
import React from 'react';
import { StyleSheet } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';
import { render, screen } from '@testing-library/react-native';
import { darkTheme } from '../../../unistyles';
import { WallBoundaryBox } from '../WallBoundaryBox';

const TS = darkTheme.wall.typeScale; // 1.4, test-locked in wall-tokens.test.ts

describe('WallBoundaryBox §5', () => {
  afterEach(() => {
    Object.assign(UnistylesRuntime.screen, { width: 0, height: 0 });
  });

  it('Fire HD 8 (1280x800): sized to the §3 window in editor px, anchored at the canvas origin', () => {
    Object.assign(UnistylesRuntime.screen, { width: 1280, height: 800 });
    render(<WallBoundaryBox />);
    const box = StyleSheet.flatten(screen.getByTestId('wall-boundary-box').props.style);
    expect(box.top).toBe(0);
    expect(box.left).toBe(0);
    expect(box.width).toBeCloseTo(1280 / TS, 3); // 914.29 = visibleUnits.w x UNIT_PX
    expect(box.height).toBeCloseTo(800 / TS, 3); // 571.43 = visibleUnits.h x UNIT_PX
  });

  it('shows the device-computed tag "WALL · 11.4 x 7.1" (one decimal)', () => {
    Object.assign(UnistylesRuntime.screen, { width: 1280, height: 800 });
    render(<WallBoundaryBox />);
    expect(screen.getByTestId('wall-boundary-tag')).toBeTruthy();
    expect(screen.getByText('WALL · 11.4 x 7.1')).toBeTruthy();
  });

  it('takes NO touch (pointerEvents none): it informs, it never polices (§5)', () => {
    Object.assign(UnistylesRuntime.screen, { width: 1280, height: 800 });
    render(<WallBoundaryBox />);
    expect(screen.getByTestId('wall-boundary-box').props.pointerEvents).toBe('none');
  });

  it('uses the wall LANDSCAPE steady state even when the editor screen is portrait (§5)', () => {
    // A portrait editor still yields the landscape wall window (long edge = width); the box never lies.
    Object.assign(UnistylesRuntime.screen, { width: 800, height: 1280 });
    render(<WallBoundaryBox />);
    const box = StyleSheet.flatten(screen.getByTestId('wall-boundary-box').props.style);
    expect(box.width).toBeCloseTo(1280 / TS, 3); // the long edge, not the portrait 800
    expect(box.height).toBeCloseTo(800 / TS, 3);
    expect(screen.getByText('WALL · 11.4 x 7.1')).toBeTruthy(); // the tag is landscape too
  });

  it('renders nothing when the screen is unknown (0x0): never a 0-box', () => {
    Object.assign(UnistylesRuntime.screen, { width: 0, height: 0 });
    render(<WallBoundaryBox />);
    expect(screen.queryByTestId('wall-boundary-box')).toBeNull();
  });
});
