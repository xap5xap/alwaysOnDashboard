// Component band: the card-altitude page capsule (AOD-145; Many Skies §1b "the dots, grown"). It proves the
// dot-per-sky + current mark, the single-sky case (one dot — the capsule is a BUTTON, not the calm Glance
// indicator, so it never blanks), the press -> rise callback, and the wake/sink contract it shares with the
// ModeDial: interactive only while awake (sunk => pointerEvents:none + dropped from the a11y tree, so a touch
// that merely WAKES the chrome can't also rise a level). The opacity fade is reanimated (device, AOD-190); the
// synchronous, testable signal is pointerEvents.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PageCapsule } from '../PageCapsule';

describe('PageCapsule §1b', () => {
  it('renders a dot per sky and marks the current one selected', () => {
    render(<PageCapsule count={3} current={1} awake onRise={jest.fn()} />);
    expect(screen.getByTestId('page-capsule-dot-0').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('page-capsule-dot-1').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('page-capsule-dot-2').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('a single sky still shows one dot (the capsule is a button — the door up must not blank)', () => {
    render(<PageCapsule count={1} current={0} awake onRise={jest.fn()} />);
    expect(screen.getByTestId('page-capsule-dot-0')).toBeTruthy();
    expect(screen.queryByTestId('page-capsule-dot-1')).toBeNull();
  });

  it('pressing the capsule rises (onRise)', () => {
    const onRise = jest.fn();
    render(<PageCapsule count={2} current={0} awake onRise={onRise} />);
    fireEvent.press(screen.getByTestId('page-capsule-press'));
    expect(onRise).toHaveBeenCalled();
  });

  it('is interactive when awake and non-interactive + a11y-hidden when sunk', () => {
    const { rerender } = render(<PageCapsule count={2} current={0} awake onRise={jest.fn()} />);
    expect(screen.getByTestId('page-capsule').props.pointerEvents).toBe('auto');

    rerender(<PageCapsule count={2} current={0} awake={false} onRise={jest.fn()} />);
    const sunk = screen.getByTestId('page-capsule', { includeHiddenElements: true });
    expect(sunk.props.pointerEvents).toBe('none');
    expect(sunk.props.accessibilityElementsHidden).toBe(true);
  });
});
