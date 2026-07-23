// Component band: the Glance page dots + add control (AOD-144; design "Many Skies" §1a/§1e). It proves the
// dot-per-sky + current-selection contract, the single-sky suppression (no dots, only the +), the + callback,
// and — the wake/sink contract it shares with the ModeDial — that it is INTERACTIVE only while awake: sunk,
// it is pointerEvents:none AND dropped from the a11y tree, so a touch that WAKES the chrome can't also hit the
// + or a dot. The opacity fade is reanimated (device, AOD-190); the synchronous, testable signal is
// pointerEvents.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PageDots } from '../PageDots';

describe('PageDots §1a/§1e', () => {
  it('renders a dot per sky and marks the current one selected', () => {
    render(<PageDots count={3} current={1} awake onAdd={jest.fn()} />);
    expect(screen.getByTestId('page-dots-dot-0').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('page-dots-dot-1').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('page-dots-dot-2').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('a single sky shows the + but NO dots (position is meaningless with one page)', () => {
    render(<PageDots count={1} current={0} awake onAdd={jest.fn()} />);
    expect(screen.queryByTestId('page-dots-dots')).toBeNull();
    expect(screen.queryByTestId('page-dots-dot-0')).toBeNull();
    expect(screen.getByTestId('page-dots-add')).toBeTruthy();
  });

  it('fires onAdd when the + is pressed', () => {
    const onAdd = jest.fn();
    render(<PageDots count={2} current={0} awake onAdd={onAdd} />);
    fireEvent.press(screen.getByTestId('page-dots-add'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('is interactive (box-none, so swipes still pass) when awake', () => {
    render(<PageDots count={2} current={0} awake onAdd={jest.fn()} />);
    expect(screen.getByTestId('page-dots').props.pointerEvents).toBe('box-none');
  });

  it('is non-interactive (pointerEvents:none) and a11y-hidden when sunk', () => {
    render(<PageDots count={2} current={0} awake={false} onAdd={jest.fn()} />);
    const dots = screen.getByTestId('page-dots', { includeHiddenElements: true });
    expect(dots.props.pointerEvents).toBe('none');
    expect(dots.props.accessibilityElementsHidden).toBe(true);
  });
});
