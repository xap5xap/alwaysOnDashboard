// Toggle / Segmented / Pills (design-component-library.md §7): the switch, the exclusive segmented
// control, and the multi-select pills.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Toggle } from '../Toggle';
import { Segmented } from '../Segmented';
import { Pills } from '../Pills';

describe('Toggle §7', () => {
  it('reports the switch role + checked state and toggles on press', () => {
    const onValueChange = jest.fn();
    render(<Toggle value={false} onValueChange={onValueChange} testID="sw" />);
    const sw = screen.getByTestId('sw');
    expect(sw.props.accessibilityRole).toBe('switch');
    expect(sw.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('toggle-knob')).toBeTruthy();
    fireEvent.press(sw);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('disabled: does not fire', () => {
    const onValueChange = jest.fn();
    render(<Toggle value={false} onValueChange={onValueChange} disabled testID="sw" />);
    fireEvent.press(screen.getByTestId('sw'));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe('Segmented §7 (exclusive)', () => {
  const options = [
    { label: 'Comfortable', value: 'comfortable' },
    { label: 'Compact', value: 'compact' },
  ];

  it('marks the selected segment and fires onChange with the value', () => {
    const onChange = jest.fn();
    render(<Segmented options={options} value="comfortable" onChange={onChange} />);
    expect(screen.getByTestId('segmented-comfortable').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('segmented-compact').props.accessibilityState).toMatchObject({ selected: false });
    fireEvent.press(screen.getByTestId('segmented-compact'));
    expect(onChange).toHaveBeenCalledWith('compact');
  });
});

describe('Pills §7 (multi-select)', () => {
  const options = [
    { label: 'Alpha', value: 'alpha' },
    { label: 'Bravo', value: 'bravo' },
  ];

  it('reflects the selected set and fires onToggle with the pressed value', () => {
    const onToggle = jest.fn();
    render(<Pills options={options} selected={['alpha']} onToggle={onToggle} />);
    expect(screen.getByTestId('pill-alpha').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('pill-bravo').props.accessibilityState).toMatchObject({ selected: false });
    fireEvent.press(screen.getByTestId('pill-bravo'));
    expect(onToggle).toHaveBeenCalledWith('bravo');
  });
});
