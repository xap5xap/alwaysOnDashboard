// AOD-10 §4.2 validateConfig units (testing-strategy.md §4.1).
import { validateConfig } from '../config';
import type { WidgetConfigSchema } from '../../registry/types';

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
});
