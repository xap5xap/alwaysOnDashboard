// Component band: the Glance | Arrange dial (AOD-142; design §1e). It proves the dial reflects the mode,
// flips it on a segment press, and — the wake/sink contract — is INTERACTIVE only while awake: sunk, it is
// pointerEvents:none, so a touch that WAKES the chrome can't also flip the mode ("waking ≠ editing", and a
// brush can't flip a control it can't touch). The opacity fade is reanimated (device, AOD-190); the
// synchronous, testable signal is pointerEvents.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ModeDial } from '../ModeDial';

describe('ModeDial §1e', () => {
  it('renders both segments and marks Glance active', () => {
    render(<ModeDial mode="glance" awake onChange={jest.fn()} />);
    expect(screen.getByTestId('segmented-glance').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('segmented-arrange').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('reflects Arrange as the active mode', () => {
    render(<ModeDial mode="arrange" awake onChange={jest.fn()} />);
    expect(screen.getByTestId('segmented-arrange').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('segmented-glance').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('flips the mode on a segment press', () => {
    const onChange = jest.fn();
    render(<ModeDial mode="glance" awake onChange={onChange} />);
    fireEvent.press(screen.getByTestId('segmented-arrange'));
    expect(onChange).toHaveBeenCalledWith('arrange');
  });

  it('is interactive when awake', () => {
    render(<ModeDial mode="glance" awake onChange={jest.fn()} testID="dial" />);
    expect(screen.getByTestId('dial').props.pointerEvents).toBe('auto');
  });

  it('is non-interactive (pointerEvents:none) and a11y-hidden when sunk — a waking touch cannot flip it', () => {
    render(<ModeDial mode="glance" awake={false} onChange={jest.fn()} testID="dial" />);
    // Sunk = intentionally dropped from the a11y tree (a screen reader must not focus an invisible control),
    // so the query opts into hidden elements; it stays pointerEvents:none so the waking touch can't flip it.
    const dial = screen.getByTestId('dial', { includeHiddenElements: true });
    expect(dial.props.pointerEvents).toBe('none');
    expect(dial.props.accessibilityElementsHidden).toBe(true);
  });
});
