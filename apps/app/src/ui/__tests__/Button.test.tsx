// Button (design-component-library.md §5): the four variants, three sizes, and the five states.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button §5', () => {
  it('renders the label and fires onPress when enabled', () => {
    const onPress = jest.fn();
    render(<Button label="Connect" onPress={onPress} testID="btn" />);
    expect(screen.getByText('Connect')).toBeTruthy();
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders all four variants and three sizes', () => {
    render(
      <>
        {(['primary', 'secondary', 'ghost', 'destructive'] as const).map((v) => (
          <Button key={v} label={v} variant={v} />
        ))}
        {(['sm', 'md', 'lg'] as const).map((s) => (
          <Button key={s} label={`size-${s}`} size={s} />
        ))}
      </>,
    );
    for (const v of ['primary', 'secondary', 'ghost', 'destructive']) expect(screen.getByText(v)).toBeTruthy();
    for (const s of ['sm', 'md', 'lg']) expect(screen.getByText(`size-${s}`)).toBeTruthy();
  });

  it('disabled: does not fire onPress and reports disabled to a11y', () => {
    const onPress = jest.fn();
    render(<Button label="Save" disabled onPress={onPress} testID="btn" />);
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('loading: shows a spinner, KEEPS the label, and is non-interactive', () => {
    const onPress = jest.fn();
    render(<Button label="Saving" loading onPress={onPress} testID="btn" />);
    expect(screen.getByTestId('button-spinner')).toBeTruthy();
    expect(screen.getByText('Saving')).toBeTruthy(); // §5: the label stays alongside the spinner
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('focused: draws the shared focus ring; unfocused: none', () => {
    const { rerender } = render(<Button label="x" focused />);
    expect(screen.getByTestId('focus-ring')).toBeTruthy();
    rerender(<Button label="x" />);
    expect(screen.queryByTestId('focus-ring')).toBeNull();
  });
});
