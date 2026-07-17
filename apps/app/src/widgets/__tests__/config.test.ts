// AOD-10 §4.2 validateConfig units (testing-strategy.md §4.1).
import { applyCaptionLabels, configLabelKeys, validateConfig } from '../config';
import type { Choice, WidgetConfigSchema } from '../../registry/types';

describe('validateConfig (AOD-10 §4.2)', () => {
  it('errors when a required field is absent', () => {
    const schema: WidgetConfigSchema = { fields: [{ key: 'p', label: 'P', kind: 'string', required: true }] };
    expect(validateConfig(schema, {}).ok).toBe(false);
  });

  it('applies the default for an absent optional field', () => {
    const schema: WidgetConfigSchema = {
      fields: [{ key: 'f', label: 'F', kind: 'enum', required: false, default: 'open', options: [{ value: 'open', label: 'Open' }] }],
    };
    expect(validateConfig(schema, {})).toEqual({ ok: true, values: { f: 'open' } });
  });

  it('honors number min/max/step', () => {
    const schema: WidgetConfigSchema = { fields: [{ key: 'n', label: 'N', kind: 'number', required: true, min: 0, max: 10, step: 2 }] };
    expect(validateConfig(schema, { n: 4 }).ok).toBe(true);
    expect(validateConfig(schema, { n: 11 }).ok).toBe(false);
    expect(validateConfig(schema, { n: 3 }).ok).toBe(false); // not aligned to step 2 from 0
  });

  it('enforces enum membership', () => {
    const schema: WidgetConfigSchema = { fields: [{ key: 'e', label: 'E', kind: 'enum', required: true, options: [{ value: 'a', label: 'A' }] }] };
    expect(validateConfig(schema, { e: 'a' }).ok).toBe(true);
    expect(validateConfig(schema, { e: 'z' }).ok).toBe(false);
  });

  it('enforces remote-options membership when resolvedOptions is provided', () => {
    const schema: WidgetConfigSchema = {
      fields: [{ key: 'proj', label: 'Project', kind: 'remote-options', required: true, source: { optionSource: 'linear_projects' } }],
    };
    const resolved = { proj: [{ value: 'P1', label: 'One' }] };
    expect(validateConfig(schema, { proj: 'P1' }, resolved).ok).toBe(true);
    expect(validateConfig(schema, { proj: 'GONE' }, resolved).ok).toBe(false);
  });

  it('validates remote-options as unverified (accepts) when resolvedOptions is absent', () => {
    const schema: WidgetConfigSchema = {
      fields: [{ key: 'proj', label: 'Project', kind: 'remote-options', required: true, source: { optionSource: 'linear_projects' } }],
    };
    expect(validateConfig(schema, { proj: 'P1' }).ok).toBe(true);
  });

  it('ignores a non-field key like a persisted caption label (leaves it out of the values)', () => {
    const schema: WidgetConfigSchema = {
      fields: [{ key: 'calendarId', label: 'Calendar', kind: 'remote-options', required: true, source: { optionSource: 'google_calendars' }, labelKey: 'calendarLabel' }],
    };
    // validateConfig only iterates schema fields; the labelKey key never appears in the result values.
    const r = validateConfig(schema, { calendarId: 'me@x', calendarLabel: 'Personal' });
    expect(r).toEqual({ ok: true, values: { calendarId: 'me@x' } });
  });
});

// AOD-124: the caption label helpers. configLabelKeys names the display-only keys the host strips from the
// fetch params; applyCaptionLabels persists the chosen choice's label at save so the caption has a name.
describe('configLabelKeys (AOD-124)', () => {
  it('returns the labelKey of each single-select remote-options field', () => {
    const schema: WidgetConfigSchema = {
      fields: [
        { key: 'projectId', label: 'Project', kind: 'remote-options', required: true, source: { optionSource: 'linear_projects' }, labelKey: 'projectLabel' },
        { key: 'filter', label: 'Show', kind: 'enum', required: false, options: [{ value: 'open', label: 'Open' }] },
      ],
    };
    expect(configLabelKeys(schema)).toEqual(['projectLabel']);
  });

  it('excludes remote-options fields without a labelKey and multi-select fields', () => {
    const schema: WidgetConfigSchema = {
      fields: [
        { key: 'a', label: 'A', kind: 'remote-options', required: true, source: { optionSource: 's' } },
        { key: 'b', label: 'B', kind: 'remote-options', required: false, multiple: true, source: { optionSource: 's' }, labelKey: 'bLabel' },
      ],
    };
    expect(configLabelKeys(schema)).toEqual([]);
  });

  it('is empty for a schema with no remote-options fields (Clock)', () => {
    const schema: WidgetConfigSchema = { fields: [{ key: 'tz', label: 'TZ', kind: 'string', required: false }] };
    expect(configLabelKeys(schema)).toEqual([]);
  });
});

describe('applyCaptionLabels (AOD-124)', () => {
  const schema: WidgetConfigSchema = {
    fields: [{ key: 'calendarId', label: 'Calendar', kind: 'remote-options', required: true, source: { optionSource: 'google_calendars' }, labelKey: 'calendarLabel' }],
  };
  const choices: Record<string, Choice[]> = {
    calendarId: [
      { value: 'me@x', label: 'Personal' },
      { value: 'work@x', label: 'Work' },
    ],
  };

  it('writes the chosen choice label under the labelKey', () => {
    const out = applyCaptionLabels(schema, { calendarId: 'work@x' }, choices, {});
    expect(out).toEqual({ calendarId: 'work@x', calendarLabel: 'Work' });
  });

  it('preserves the previous label when the choices are unavailable but the selection is unchanged', () => {
    const previous = { calendarId: 'me@x', calendarLabel: 'Personal' };
    const out = applyCaptionLabels(schema, { calendarId: 'me@x' }, {}, previous);
    expect(out.calendarLabel).toBe('Personal');
  });

  it('drops the label when the selection changed but the new choice cannot be resolved', () => {
    const previous = { calendarId: 'me@x', calendarLabel: 'Personal' };
    const out = applyCaptionLabels(schema, { calendarId: 'other@x' }, {}, previous);
    expect(out.calendarLabel).toBeUndefined();
  });

  it('drops the label when the selection is cleared', () => {
    const previous = { calendarId: 'me@x', calendarLabel: 'Personal' };
    const out = applyCaptionLabels(schema, {}, choices, previous);
    expect(out).not.toHaveProperty('calendarLabel');
  });

  it('leaves a schema with no labelKey field untouched', () => {
    const plain: WidgetConfigSchema = { fields: [{ key: 'tz', label: 'TZ', kind: 'string', required: false }] };
    expect(applyCaptionLabels(plain, { tz: 'UTC' }, {}, {})).toEqual({ tz: 'UTC' });
  });
});
