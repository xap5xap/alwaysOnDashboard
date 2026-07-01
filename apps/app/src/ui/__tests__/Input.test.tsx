// Input (design-component-library.md §6): the four states, the label / hint / error, and the search row.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Input, SearchRow } from '../Input';

describe('Input §6', () => {
  it('renders the label + value and fires onChangeText', () => {
    const onChangeText = jest.fn();
    render(<Input label="Email" value="a@b.co" onChangeText={onChangeText} testID="field" />);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByTestId('field').props.value).toBe('a@b.co');
    fireEvent.changeText(screen.getByTestId('field'), 'x@y.co');
    expect(onChangeText).toHaveBeenCalledWith('x@y.co');
  });

  it('error: shows the error line below (and hides the hint)', () => {
    render(<Input value="" hint="A hint" error="Required" testID="field" />);
    expect(screen.getByTestId('input-error')).toBeTruthy();
    expect(screen.getByText('Required')).toBeTruthy();
    expect(screen.queryByText('A hint')).toBeNull();
  });

  it('focus: renders the accentMuted halo only when focused (and not disabled)', () => {
    const { rerender } = render(<Input value="" focused testID="field" />);
    expect(screen.getByTestId('input-focus-halo')).toBeTruthy();
    rerender(<Input value="" focused disabled testID="field" />);
    expect(screen.queryByTestId('input-focus-halo')).toBeNull();
  });

  it('disabled: the field is not editable', () => {
    render(<Input value="" disabled testID="field" />);
    expect(screen.getByTestId('field').props.editable).toBe(false);
  });

  it('SearchRow: renders the primary Search button and fires onSearch', () => {
    const onSearch = jest.fn();
    render(<SearchRow value="Quito" onSearch={onSearch} label="Location" testID="q" />);
    expect(screen.getByText('Search')).toBeTruthy();
    fireEvent.press(screen.getByTestId('search-row-submit'));
    expect(onSearch).toHaveBeenCalled();
  });
});
