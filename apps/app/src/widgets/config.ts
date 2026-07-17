// Per-instance config validation (AOD-10 §4.2). Pure; the single generic validator over a
// WidgetConfigSchema. This is the client UX/render-time check (rule 1 and 2 of §4.2); the proxy is
// the only line of trust (rule 3, server-side). The unverified allowance for remote-options is
// deliberate: a provider outage must not block saving or erase a previously valid selection.
import type { Choice, WidgetConfigField, WidgetConfigSchema } from '../registry/types';

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

// --- caption labels (AOD-124) --------------------------------------------------------------------
// A single-select remote-options field may declare a `labelKey`: the config form persists the chosen
// choice's LABEL under that key so a per-widget caption (place / project·team / calendar) can show a human
// name the stored id and the payload both lack. These keys are DISPLAY-ONLY — not schema fields — so
// validateConfig ignores them (they never appear in a field loop) and the host strips them from the fetch
// params (WidgetHost, via configLabelKeys) so they never enter the requestKey or the provider request.

/** Return every single-select remote-options field with a labelKey. */
function labelFields(schema: WidgetConfigSchema): Extract<WidgetConfigField, { kind: 'remote-options' }>[] {
  return schema.fields.filter(
    (f): f is Extract<WidgetConfigField, { kind: 'remote-options' }> =>
      f.kind === 'remote-options' && f.multiple !== true && typeof f.labelKey === 'string',
  );
}

/** The config keys that hold a persisted display label. Used by the host to strip them from fetch params. */
export function configLabelKeys(schema: WidgetConfigSchema): string[] {
  return labelFields(schema).map((f) => f.labelKey as string);
}

/**
 * Persist each labelKey field's chosen LABEL alongside the validated values (AOD-124). Pure: given the
 * validated values, the ready choice sets, and the instance's previous config, it writes `labelKey` from
 * the selected choice. When the choices are unavailable (a provider outage at save) but the selection is
 * unchanged, the previous label is preserved so a valid caption survives the outage; when the selection is
 * cleared or no label can be resolved, the key is left unset (the caption falls back to the widget name).
 */
export function applyCaptionLabels(
  schema: WidgetConfigSchema,
  values: Record<string, unknown>,
  resolvedOptions: Record<string, Choice[]>,
  previous: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...values };
  for (const field of labelFields(schema)) {
    const labelKey = field.labelKey as string;
    const selected = values[field.key];
    if (typeof selected !== 'string' || selected === '') {
      delete out[labelKey]; // selection cleared: no caption label to carry
      continue;
    }
    const match = resolvedOptions[field.key]?.find((c) => c.value === selected);
    if (match) {
      out[labelKey] = match.label;
    } else if (selected === previous[field.key] && typeof previous[labelKey] === 'string') {
      out[labelKey] = previous[labelKey]; // unchanged selection, choices unavailable: keep the last label
    } else {
      delete out[labelKey]; // no reliable label: leave unset (caption reverts to the widget name)
    }
  }
  return out;
}
