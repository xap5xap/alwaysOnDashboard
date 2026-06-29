// Per-instance config validation (AOD-10 §4.2). Pure; the single generic validator over a
// WidgetConfigSchema. This is the client UX/render-time check (rule 1 and 2 of §4.2); the proxy is
// the only line of trust (rule 3, server-side). The unverified allowance for remote-options is
// deliberate: a provider outage must not block saving or erase a previously valid selection.
import type { Choice, WidgetConfigSchema } from '../registry/types';

export type ConfigError = { key: string; message: string };
export type ConfigValidation =
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; errors: ConfigError[] };

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

export function validateConfig(
  schema: WidgetConfigSchema,
  raw: Record<string, unknown>,
  resolvedOptions?: Record<string, Choice[]>,
  // Save-time only: when set, a string field's optional `validate` runs after the static checks
  // (integration-clock.md §5.2, the Intl time-zone check). The config form passes this; the host's
  // render-time check does NOT, so a value that can degrade gracefully never trips needs_config (§5.4).
  opts?: { runFieldValidators?: boolean },
): ConfigValidation {
  const errors: ConfigError[] = [];
  const values: Record<string, unknown> = {};

  for (const field of schema.fields) {
    const value = raw[field.key];

    if (isEmpty(value)) {
      if (field.required) {
        errors.push({ key: field.key, message: `${field.label} is required` });
        continue;
      }
      const def = 'default' in field ? field.default : undefined;
      if (def !== undefined) values[field.key] = def;
      continue;
    }

    switch (field.kind) {
      case 'string': {
        if (typeof value !== 'string') {
          errors.push({ key: field.key, message: `${field.label} must be a string` });
          break;
        }
        if (field.minLength != null && value.length < field.minLength) {
          errors.push({ key: field.key, message: `${field.label} is too short` });
          break;
        }
        if (field.maxLength != null && value.length > field.maxLength) {
          errors.push({ key: field.key, message: `${field.label} is too long` });
          break;
        }
        if (field.pattern != null && !new RegExp(field.pattern).test(value)) {
          errors.push({ key: field.key, message: `${field.label} is invalid` });
          break;
        }
        if (opts?.runFieldValidators && field.validate) {
          const msg = field.validate(value);
          if (msg) {
            errors.push({ key: field.key, message: msg });
            break;
          }
        }
        values[field.key] = value;
        break;
      }
      case 'number': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push({ key: field.key, message: `${field.label} must be a number` });
          break;
        }
        if (field.min != null && value < field.min) {
          errors.push({ key: field.key, message: `${field.label} is below the minimum` });
          break;
        }
        if (field.max != null && value > field.max) {
          errors.push({ key: field.key, message: `${field.label} is above the maximum` });
          break;
        }
        if (field.step != null) {
          const base = field.min ?? 0;
          const k = (value - base) / field.step;
          if (Math.abs(k - Math.round(k)) > 1e-9) {
            errors.push({ key: field.key, message: `${field.label} must align to ${field.step}` });
            break;
          }
        }
        values[field.key] = value;
        break;
      }
      case 'boolean': {
        if (typeof value !== 'boolean') {
          errors.push({ key: field.key, message: `${field.label} must be a boolean` });
          break;
        }
        values[field.key] = value;
        break;
      }
      case 'enum': {
        if (!field.options.some((o) => o.value === value)) {
          errors.push({ key: field.key, message: `${field.label} is not an allowed option` });
          break;
        }
        values[field.key] = value;
        break;
      }
      case 'remote-options': {
        const list = field.multiple ? (Array.isArray(value) ? value : [value]) : [value];
        if (!list.every((v) => typeof v === 'string')) {
          errors.push({ key: field.key, message: `${field.label} must be a string id` });
          break;
        }
        const opts = resolvedOptions?.[field.key];
        if (opts) {
          const allowed = new Set(opts.map((o) => o.value));
          if (!list.every((v) => allowed.has(v as string))) {
            errors.push({ key: field.key, message: `${field.label} has an unknown selection` });
            break;
          }
        }
        // No resolvedOptions: validate as unverified (accept); membership is re-checked at render.
        values[field.key] = value;
        break;
      }
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, values };
}
