// AOD-211 (design-quick-actions-menu.md §6): the trackless footprint size picker. It is a NEW control (not
// the AOD-148 Segmented, §9): one footprint cell per SUPPORTED size, the current one marked, a press reports
// the size. The glyph shapes + the accent selected wash are visual (device-verified); these lock the
// behaviour contract the quick-actions menu leans on.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FootprintSizePicker } from '../FootprintSizePicker';

describe('FootprintSizePicker (AOD-211)', () => {
  it('renders one cell per supported size and reports a pressed size', () => {
    const onChange = jest.fn();
    render(<FootprintSizePicker options={['S', 'M', 'W', 'L']} value="M" onChange={onChange} testID="fp" />);
    for (const s of ['S', 'M', 'W', 'L']) {
      expect(screen.getByTestId(`fp-${s}`)).toBeTruthy();
    }
    fireEvent.press(screen.getByTestId('fp-W'));
    expect(onChange).toHaveBeenCalledWith('W');
  });

  it('marks the current size and only that one', () => {
    render(<FootprintSizePicker options={['S', 'W', 'L']} value="W" testID="fp" />);
    expect(screen.getByTestId('fp-W').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('fp-S').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('fp-L').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('shows only the given subset (Clock = S/W/L, no M)', () => {
    render(<FootprintSizePicker options={['S', 'W', 'L']} value="S" testID="fp" />);
    expect(screen.queryByTestId('fp-M')).toBeNull();
  });
});
