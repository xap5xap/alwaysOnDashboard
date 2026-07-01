// Surfaces (design-component-library.md §8): the RowGroup with dividers, the ListRow anatomy, the AuthCard.
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { RowGroup, ListRow, AuthCard, Wordmark } from '../Surfaces';

describe('RowGroup §8', () => {
  it('splits N rows with N-1 border dividers', () => {
    render(
      <RowGroup testID="group">
        <ListRow title="One" />
        <ListRow title="Two" />
        <ListRow title="Three" />
      </RowGroup>,
    );
    expect(screen.getByTestId('group')).toBeTruthy();
    expect(screen.getAllByTestId('row-divider')).toHaveLength(2); // 3 rows -> 2 dividers
  });
});

describe('ListRow §8', () => {
  it('renders the leading / identity / trailing slots', () => {
    render(
      <ListRow
        title="Linear"
        subtitle="Connected"
        leading={<Text>L</Text>}
        trailing={<Text>Disconnect</Text>}
      />,
    );
    expect(screen.getByText('Linear')).toBeTruthy();
    expect(screen.getByText('Connected')).toBeTruthy();
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('Disconnect')).toBeTruthy();
  });
});

describe('AuthCard §8', () => {
  it('renders the wordmark and its children', () => {
    render(
      <AuthCard testID="auth">
        <Wordmark testID="wordmark" />
        <Text>Sign in to your dashboard</Text>
      </AuthCard>,
    );
    expect(screen.getByTestId('auth')).toBeTruthy();
    expect(screen.getByText('vela')).toBeTruthy();
    expect(screen.getByText('Sign in to your dashboard')).toBeTruthy();
  });
});
