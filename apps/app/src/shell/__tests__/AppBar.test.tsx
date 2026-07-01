// The app bar (design-core-navigation.md §3): the two header patterns. Hub = the vela wordmark + a right
// action cluster (over a bottom border); pushed = a back affordance + the screen title.
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AppBar } from '../AppBar';

describe('AppBar §3 hub', () => {
  it('renders the vela wordmark and the right action cluster', () => {
    render(<AppBar variant="hub" right={<Text>Add</Text>} testID="hub" />);
    expect(screen.getByTestId('hub')).toBeTruthy();
    expect(screen.getByText('vela')).toBeTruthy();
    expect(screen.getByText('Add')).toBeTruthy();
  });
});

describe('AppBar §3 pushed', () => {
  it('renders the title and a back affordance that fires onBack', () => {
    const onBack = jest.fn();
    render(<AppBar variant="pushed" title="Account" onBack={onBack} />);
    expect(screen.getByText('Account')).toBeTruthy();
    fireEvent.press(screen.getByTestId('appbar-back'));
    expect(onBack).toHaveBeenCalled();
  });

  it('omits the back affordance on a root-of-stack screen (no onBack)', () => {
    render(<AppBar variant="pushed" title="Themes" />);
    expect(screen.getByText('Themes')).toBeTruthy();
    expect(screen.queryByTestId('appbar-back')).toBeNull();
  });
});
