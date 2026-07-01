// Component-band tests for the generic config form (AOD-10 §4.1 field kinds, §4.2 validation place 1).
// They prove the form is generic over field kinds (one input per static kind, rendered from a schema it
// is handed), pre-fills from the current config, validates on save with the EXISTING validateConfig
// (field-level errors, no submit on failure), and on success hands back the NORMALIZED values (defaults
// applied, number coerced from text). remote-options is out of scope and must render without crashing.
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { ConfigForm } from '../ConfigForm';
import type { ResolvedOptionsState } from '../useOptionSources';
import type { Choice, WidgetConfigSchema } from '../../registry/types';

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
  it('renders a string, number, boolean, and enum input from the schema (AOD-67 controls)', () => {
    setup();
    expect(screen.getByTestId('config-field-name')).toBeTruthy(); // Input (string)
    expect(screen.getByTestId('config-field-count')).toBeTruthy(); // Input (number)
    expect(screen.getByTestId('config-toggle-live')).toBeTruthy(); // Toggle (was the native Switch)
    expect(screen.getByTestId('config-enum-density')).toBeTruthy(); // Segmented group
    expect(screen.getByTestId('segmented-comfortable')).toBeTruthy();
    expect(screen.getByTestId('segmented-compact')).toBeTruthy();
  });

  it('pre-fills inputs from the current config, falling back to schema defaults', () => {
    setup({ name: 'Wall', count: 7 });
    expect(screen.getByTestId('config-field-name').props.value).toBe('Wall');
    expect(screen.getByTestId('config-field-count').props.value).toBe('7');
  });

});

describe('remote-options picker (AOD-10 §4.3), fed by the resolved Choice[]', () => {
  const remoteSchema: WidgetConfigSchema = {
    fields: [
      { key: 'project', label: 'Project', kind: 'remote-options', required: true, source: { optionSource: 'stub_options' } },
      { key: 'tags', label: 'Tags', kind: 'remote-options', required: false, multiple: true, default: [], source: { optionSource: 'stub_options' } },
    ],
  };
  const CHOICES: Choice[] = [
    { value: 'alpha', label: 'Alpha' },
    { value: 'bravo', label: 'Bravo' },
  ];
  const ready: ResolvedOptionsState = { status: 'ready', choices: CHOICES };

  function renderRemote(opts: {
    initial?: Record<string, unknown>;
    options?: Record<string, ResolvedOptionsState>;
    onReconnect?: () => void;
  }) {
    const onSubmit = jest.fn();
    render(
      <ConfigForm
        schema={remoteSchema}
        initial={opts.initial ?? {}}
        title="t"
        options={opts.options}
        serviceName="Stub"
        onReconnect={opts.onReconnect ?? jest.fn()}
        onSubmit={onSubmit}
        onCancel={jest.fn()}
      />,
    );
    return { onSubmit };
  }

  it('shows a loading state until the choices resolve', () => {
    renderRemote({ options: { project: { status: 'loading' }, tags: { status: 'loading' } } });
    expect(screen.getByTestId('config-remote-loading-project')).toBeTruthy();
  });

  it('renders the resolved choices as AOD-67 Pills and stores the stable id (single-select)', () => {
    const { onSubmit } = renderRemote({ options: { project: ready, tags: ready } });
    // Each remote field wraps its Pills in a `config-remote-<key>` View so the `pill-<value>` segments
    // stay addressable per field (two remote fields share option values here).
    const project = within(screen.getByTestId('config-remote-project'));
    expect(project.getByTestId('pill-alpha')).toBeTruthy();
    fireEvent.press(project.getByTestId('pill-bravo'));
    fireEvent.press(screen.getByTestId('config-submit'));
    expect(onSubmit).toHaveBeenCalledWith({ project: 'bravo', tags: [] });
  });

  it('multi-select toggles store an array of stable ids', () => {
    const { onSubmit } = renderRemote({ initial: { project: 'alpha' }, options: { project: ready, tags: ready } });
    const tags = within(screen.getByTestId('config-remote-tags'));
    fireEvent.press(tags.getByTestId('pill-alpha'));
    fireEvent.press(tags.getByTestId('pill-bravo'));
    fireEvent.press(tags.getByTestId('pill-alpha')); // toggle alpha back off
    fireEvent.press(screen.getByTestId('config-submit'));
    expect(onSubmit).toHaveBeenCalledWith({ project: 'alpha', tags: ['bravo'] });
  });

  it('enforces membership on save: a stored value absent from the resolved set is rejected (AOD-10 §4.2)', () => {
    const { onSubmit } = renderRemote({ initial: { project: 'ghost' }, options: { project: ready, tags: ready } });
    fireEvent.press(screen.getByTestId('config-submit'));
    expect(screen.getByTestId('config-error-project')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('accepts a stored value as unverified when the set is unavailable (provider outage, AOD-10 §4.2 rule 2)', () => {
    // No options passed for project: validateConfig cannot check membership, so a stored id is accepted.
    const { onSubmit } = renderRemote({ initial: { project: 'ghost' }, options: { project: { status: 'loading' } } });
    fireEvent.press(screen.getByTestId('config-submit'));
    expect(onSubmit).toHaveBeenCalledWith({ project: 'ghost', tags: [] });
  });

  it('a provider error shows a retry affordance', () => {
    const retry = jest.fn();
    renderRemote({ options: { project: { status: 'error', retry }, tags: { status: 'error', retry } } });
    fireEvent.press(screen.getAllByText('Retry')[0]);
    expect(retry).toHaveBeenCalled();
  });

  it('a 409 shows the reconnect affordance and routes through onReconnect', () => {
    const retry = jest.fn();
    const onReconnect = jest.fn();
    renderRemote({
      options: { project: { status: 'needs_reconnect', retry }, tags: { status: 'needs_reconnect', retry } },
      onReconnect,
    });
    expect(screen.getByTestId('config-remote-reconnect-project')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Reconnect')[0]);
    expect(onReconnect).toHaveBeenCalled();
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
    fireEvent.press(screen.getByTestId('segmented-compact')); // enum -> Segmented
    fireEvent.press(screen.getByTestId('config-toggle-live')); // boolean -> Toggle (Pressable; press flips false->true)
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
