// Overlays (design-component-library.md §9): the bottom sheet (scrim + grabber), the center modal, and
// the anchored popover menu (no scrim).
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Sheet, Modal, Popover, MenuItem } from '../Overlays';

describe('Sheet §9', () => {
  it('when visible: renders the grabber, the scrim, and its children; the scrim dismisses', () => {
    const onRequestClose = jest.fn();
    render(
      <Sheet visible onRequestClose={onRequestClose} testID="sheet">
        <Text>Sheet body</Text>
      </Sheet>,
    );
    expect(screen.getByTestId('sheet-grabber')).toBeTruthy();
    expect(screen.getByText('Sheet body')).toBeTruthy();
    fireEvent.press(screen.getByTestId('sheet-scrim'));
    expect(onRequestClose).toHaveBeenCalled();
  });
});

describe('Modal §9', () => {
  it('renders the title and body', () => {
    render(
      <Modal visible title="Remove widget?">
        <Text>This cannot be undone.</Text>
      </Modal>,
    );
    expect(screen.getByText('Remove widget?')).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
  });
});

describe('Popover / MenuItem §9', () => {
  it('renders items split by dividers, marks the selected item, and fires onPress', () => {
    const onPress = jest.fn();
    render(
      <Popover testID="menu">
        <MenuItem label="Dark" selected onPress={onPress} testID="item-dark" />
        <MenuItem label="Light" testID="item-light" />
        <MenuItem label="System" testID="item-system" />
      </Popover>,
    );
    expect(screen.getByTestId('menu')).toBeTruthy();
    expect(screen.getByTestId('item-dark').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('item-dark'));
    expect(onPress).toHaveBeenCalled();
  });
});
