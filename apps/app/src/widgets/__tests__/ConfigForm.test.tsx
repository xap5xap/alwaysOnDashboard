// Component-band tests for the generic config form (AOD-10 §4.1 field kinds, §4.2 validation place 1).
// They prove the form is generic over field kinds (one input per static kind, rendered from a schema it
// is handed), pre-fills from the current config, validates on save with the EXISTING validateConfig
// (field-level errors, no submit on failure), and on success hands back the NORMALIZED values (defaults
// applied, number coerced from text). remote-options is out of scope and must render without crashing.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ConfigForm } from '../ConfigForm';
import type { WidgetConfigSchema } from '../../registry/types';

const schema: WidgetConfigSchema = {
  fields: [
    { key: 'name', label: 'Name', kind: 'string', required: true, minLength: 2 },
    { key: 'count', label: 'Count', kind: 'number', required: false, min: 1, max: 10, default: 3 },
    { key: 'live', label: 'Live', kind: 'boolean', required: false, default: false },
    {
      key: 'density',
      label: 'Density',
      kind: 'enum',
      required: false,
      default: 'comfortable',
      options: [
        { value: 'comfortable', label: 'Comfortable' },
        { value: 'compact', label: 'Compact' },
      ],
    },
  ],
};

function setup(initial: Record<string, unknown> = {}) {
  const onSubmit = jest.fn();
  const onCancel = jest.fn();
  render(
    <ConfigForm schema={schema} initial={initial} title="Configure Stub" onSubmit={onSubmit} onCancel={onCancel} />,
  );
  return { onSubmit, onCancel };
}

describe('ConfigForm renders one input per static field kind, generic over the schema', () => {
  it('renders a string, number, boolean, and enum input from the schema', () => {
    setup();
    expect(screen.getByTestId('config-field-name')).toBeTruthy();
    expect(screen.getByTestId('config-field-count')).toBeTruthy();
    expect(screen.getByTestId('config-switch-live')).toBeTruthy();
    expect(screen.getByTestId('config-enum-density-comfortable')).toBeTruthy();
    expect(screen.getByTestId('config-enum-density-compact')).toBeTruthy();
  });

  it('pre-fills inputs from the current config, falling back to schema defaults', () => {
    setup({ name: 'Wall', count: 7 });
    expect(screen.getByTestId('config-field-name').props.value).toBe('Wall');
    expect(screen.getByTestId('config-field-count').props.value).toBe('7');
  });

  it('renders a remote-options field as a muted note without crashing (out of scope, AOD-10 §4.3)', () => {
    const onSubmit = jest.fn();
    render(
      <ConfigForm
        schema={{ fields: [{ key: 'projectId', label: 'Project', kind: 'remote-options', required: false, source: { optionSource: 'x' } }] }}
        initial={{}}
        title="t"
        onSubmit={onSubmit}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByTestId('config-remote-projectId')).toBeTruthy();
  });
});

describe('validation on save uses validateConfig (AOD-10 §4.2)', () => {
  it('shows a field-level error and does not submit when a required field is empty', () => {
    const { onSubmit } = setup();
    fireEvent.press(screen.getByTestId('config-submit'));
    expect(screen.getByTestId('config-error-name')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric number entry with the validator message', () => {
    const { onSubmit } = setup({ name: 'ok' });
    fireEvent.changeText(screen.getByTestId('config-field-count'), 'abc');
    fireEvent.press(screen.getByTestId('config-submit'));
    expect(screen.getByTestId('config-error-count')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a number outside the declared range', () => {
    const { onSubmit } = setup({ name: 'ok' });
    fireEvent.changeText(screen.getByTestId('config-field-count'), '99');
    fireEvent.press(screen.getByTestId('config-submit'));
    expect(screen.getByTestId('config-error-count')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('a valid save returns the normalized values (defaults applied, types coerced)', () => {
  it('submits with the default count and density when only the required field is filled', () => {
    const { onSubmit } = setup();
    fireEvent.changeText(screen.getByTestId('config-field-name'), 'Wall');
    fireEvent.press(screen.getByTestId('config-submit'));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Wall', count: 3, live: false, density: 'comfortable' });
  });

  it('coerces the number text to a number and applies an enum selection and boolean toggle', () => {
    const { onSubmit } = setup();
    fireEvent.changeText(screen.getByTestId('config-field-name'), 'Wall');
    fireEvent.changeText(screen.getByTestId('config-field-count'), '8');
    fireEvent.press(screen.getByTestId('config-enum-density-compact'));
    fireEvent(screen.getByTestId('config-switch-live'), 'valueChange', true);
    fireEvent.press(screen.getByTestId('config-submit'));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Wall', count: 8, live: true, density: 'compact' });
  });
});

describe('cancel', () => {
  it('calls onCancel and never validates', () => {
    const { onCancel, onSubmit } = setup();
    fireEvent.press(screen.getByTestId('config-cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
