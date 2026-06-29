// The shared empty-body convention (design-widget-system.md §5.1): a renderer-drawn calm body with a
// glyph, a line, an optional subline, and crucially NO action (the trait that separates it from the
// host's error / needs_config / disconnected prompts).
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { EmptyBody } from '../EmptyBody';

describe('EmptyBody (AOD-37 §5.1)', () => {
  it('renders the line and the optional subline', () => {
    render(<EmptyBody line="Nothing next" subline="You're clear" />);
    expect(screen.getByText('Nothing next')).toBeTruthy();
    expect(screen.getByText("You're clear")).toBeTruthy();
  });

  it('renders the line alone when no subline is given', () => {
    render(<EmptyBody line="No active cycle" />);
    expect(screen.getByText('No active cycle')).toBeTruthy();
  });

  it('carries NO action (no button), unlike the host prompts', () => {
    render(<EmptyBody line="Nothing left today" subline="Enjoy the quiet" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('accepts a per-widget glyph slot', () => {
    render(<EmptyBody line="No spend yet this month" glyph={<Text>flat-chart</Text>} />);
    expect(screen.getByText('flat-chart')).toBeTruthy();
    expect(screen.getByTestId('widget-empty-body')).toBeTruthy();
  });
});
