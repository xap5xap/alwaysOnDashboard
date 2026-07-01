// The generic per-instance config form (AOD-10 §4.1 field kinds, §4.2 validation place 1; AOD-8 §10
// "Config form UI: renders a form from WidgetConfigSchema. Generic over field kinds."). Pure and
// presentational like WidgetHostView: it renders one input per STATIC field kind (string / number /
// boolean / enum) from a WidgetConfigSchema, pre-filled from the instance's current config, validates
// on save with the EXISTING validateConfig (never a second validator; save-time field validators like
// Clock's Intl time-zone check are run by passing runFieldValidators, not a parallel validator), surfaces
// field-level errors, and hands the caller the normalized values. It names no service and reads no registry
// beyond the schema it is given, so it works for every widget. Persistence and the entry-point wiring live
// elsewhere (dashboardRepo / the picker / the dashboard); this component only collects and validates.
//
// AOD-69 recompose (design-dashboard-editor §7, §11 drift 6): each field kind now maps onto ONE AOD-67
// control instead of an ad-hoc one -- string/number -> Input (§6), boolean -> Toggle (§7, the flagged
// native Switch swap lands here), enum -> Segmented (§7, exclusive full-accent), remote-options -> Pills
// (§7, multi-select accentMuted). Cancel is an AOD-67 ghost Button, Save the primary. The validate/coerce
// logic is UNCHANGED (validateConfig stays the one truth); only the presentation is canonicalized.
//
// remote-options (AOD-10 §4.3) is resolved by the caller (useOptionSources) and passed in via
// `options`: a real picker fed by the resolved Choice[] (single or multiple per field.multiple),
// storing the stable id(s). On save the ready sets are passed to validateConfig so membership is
// enforced when available and unverified when not (§4.2 rule 2). This component stays pure: the
// network lives in the hook at the entry points.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Choice, WidgetConfigField, WidgetConfigSchema } from '../registry/types';
import { Button, Input, Pills, Segmented, Toggle } from '../ui';
import { validateConfig } from './config';
import type { ResolvedOptionsState } from './useOptionSources';

export interface ConfigFormProps {
  schema: WidgetConfigSchema;
  /** The instance's current config (or the schema defaults on configure-on-add). Pre-fills the inputs. */
  initial: Record<string, unknown>;
  title: string;
  submitLabel?: string;
  pending?: boolean;
  /** A persist failure surfaced by the caller; field-level validation errors are owned here. */
  submitError?: string | null;
  /** Resolved remote-options sets per field key (AOD-10 §4.3), from useOptionSources. A schema with
   *  no remote-options field needs none; an unresolved field renders its loading/error/reconnect state. */
  options?: Record<string, ResolvedOptionsState>;
  /** The parent service's display name, for the remote-options reconnect prompt. */
  serviceName?: string;
  /** Routes the remote-options 409 reconnect affordance (AOD-10 §4.3). */
  onReconnect?: () => void;
  /** Receives the NORMALIZED values from validateConfig (defaults applied, types validated). */
  onSubmit(values: Record<string, unknown>): void;
  onCancel(): void;
}

/** The editable draft value a field starts from: the instance value if present, else the schema default. */
function seedValue(field: WidgetConfigField, initial: Record<string, unknown>): unknown {
  const current = initial[field.key];
  const fallback = 'default' in field ? field.default : undefined;
  const value = current !== undefined ? current : fallback;
  switch (field.kind) {
    case 'string':
      return value == null ? '' : String(value);
    case 'number':
      return value == null ? '' : String(value); // edited as text, coerced to a number on save
    case 'boolean':
      return typeof value === 'boolean' ? value : false;
    case 'enum':
      return value == null ? undefined : value;
    case 'remote-options':
      // multiple: an array of stable ids; single: a scalar id. Carry the existing selection through.
      if (field.multiple) return Array.isArray(value) ? value : value == null ? [] : [value];
      return value == null ? undefined : value;
    default:
      return value;
  }
}

function seedDraft(schema: WidgetConfigSchema, initial: Record<string, unknown>): Record<string, unknown> {
  const draft: Record<string, unknown> = {};
  for (const field of schema.fields) draft[field.key] = seedValue(field, initial);
  return draft;
}

/** Map the editable draft to the shape validateConfig expects: text number inputs become numbers, empty
 *  optionals become absent so defaults/required rules apply. This is type mapping, not validation; the
 *  single source of validation truth stays validateConfig. */
function coerceForValidation(
  schema: WidgetConfigSchema,
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const v = draft[field.key];
    switch (field.kind) {
      case 'number':
        if (v === '' || v == null) break; // absent: validateConfig applies the default or flags required
        out[field.key] = typeof v === 'string' ? Number(v) : v; // a non-numeric entry -> NaN -> rejected
        break;
      case 'string':
      case 'enum':
        if (v === '' || v == null) break;
        out[field.key] = v;
        break;
      case 'boolean':
        if (typeof v === 'boolean') out[field.key] = v;
        break;
      case 'remote-options':
        // multiple: always an array of ids; single: the scalar id, absent when empty so required/
        // default rules apply. The stable id(s) are stored, never the label (AOD-10 §4.3 step 4).
        if (field.multiple) out[field.key] = Array.isArray(v) ? v : v == null ? [] : [v];
        else if (v != null && v !== '') out[field.key] = v;
        break;
    }
  }
  return out;
}

export function ConfigForm({
  schema,
  initial,
  title,
  submitLabel = 'Save',
  pending = false,
  submitError = null,
  options,
  serviceName,
  onReconnect,
  onSubmit,
  onCancel,
}: ConfigFormProps) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => seedDraft(schema, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));

  const onSave = () => {
    // Pass the ready remote-options sets so validateConfig enforces membership when available and
    // accepts as unverified when not (AOD-10 §4.2 rule 2). Only ready fields contribute a set.
    const resolvedOptions: Record<string, Choice[]> = {};
    for (const field of schema.fields) {
      if (field.kind === 'remote-options') {
        const state = options?.[field.key];
        if (state?.status === 'ready') resolvedOptions[field.key] = state.choices;
      }
    }
    // runFieldValidators: this is the SAVE path, so run any string field's optional client validator
    // (integration-clock.md §5.2, the Intl time-zone check) on top of the static checks. The host's
    // render-time validateConfig omits this flag, so a gracefully-degrading value never trips needs_config.
    const result = validateConfig(schema, coerceForValidation(schema, draft), resolvedOptions, {
      runFieldValidators: true,
    });
    if (!result.ok) {
      setErrors(Object.fromEntries(result.errors.map((e) => [e.key, e.message])));
      return;
    }
    setErrors({});
    onSubmit(result.values);
  };

  return (
    <View style={styles.form} testID="config-form">
      <Text style={styles.title}>{title}</Text>

      {schema.fields.length === 0 && (
        <Text style={styles.muted}>This widget has no options to configure.</Text>
      )}

      {schema.fields.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.label}>
            {field.label}
            {field.required ? <Text style={styles.req}> *</Text> : null}
          </Text>
          <Field
            field={field}
            value={draft[field.key]}
            onChange={(v) => setField(field.key, v)}
            optionsState={options?.[field.key]}
            serviceName={serviceName}
            onReconnect={onReconnect}
          />
          {errors[field.key] && (
            <Text style={styles.error} testID={`config-error-${field.key}`}>
              {errors[field.key]}
            </Text>
          )}
        </View>
      ))}

      {submitError && (
        <Text style={styles.error} testID="config-submit-error">
          {submitError}
        </Text>
      )}

      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} testID="config-cancel" />
        <Button label={submitLabel} variant="primary" loading={pending} onPress={onSave} testID="config-submit" />
      </View>
    </View>
  );
}

/** One input, switched on the field kind, each an AOD-67 control (design-dashboard-editor §7). Generic:
 *  it never names a service or a specific field. */
function Field({
  field,
  value,
  onChange,
  optionsState,
  serviceName,
  onReconnect,
}: {
  field: WidgetConfigField;
  value: unknown;
  onChange(value: unknown): void;
  optionsState?: ResolvedOptionsState;
  serviceName?: string;
  onReconnect?: () => void;
}) {
  switch (field.kind) {
    case 'string':
    case 'number':
      // §6 input: one surfaceAlt fill, placeholder -> textMuted, both owned by the AOD-67 Input.
      return (
        <Input
          value={typeof value === 'string' ? value : value == null ? '' : String(value)}
          onChangeText={onChange}
          placeholder={field.kind === 'string' ? field.placeholder : undefined}
          keyboardType={field.kind === 'number' ? 'numeric' : 'default'}
          accessibilityLabel={field.label}
          testID={`config-field-${field.key}`}
        />
      );
    case 'boolean':
      // §7 toggle: the AOD-67 Toggle replaces the native Switch (§11 drift 6 / the AOD-67-shipped swap).
      return (
        <Toggle
          value={value === true}
          onValueChange={onChange}
          accessibilityLabel={field.label}
          testID={`config-toggle-${field.key}`}
        />
      );
    case 'enum':
      // §7 segmented: the exclusive static choice, full-accent selected (distinct from the multi pills).
      return (
        <Segmented
          options={field.options}
          value={typeof value === 'string' ? value : undefined}
          onChange={onChange}
          testID={`config-enum-${field.key}`}
        />
      );
    case 'remote-options':
      return (
        <RemoteOptions
          field={field}
          value={value}
          onChange={onChange}
          state={optionsState}
          serviceName={serviceName}
          onReconnect={onReconnect}
        />
      );
    default:
      return null;
  }
}

/** The remote-options picker (AOD-10 §4.3): fed by the resolved Choice[]; renders loading / error
 *  (retry) / needs_reconnect (reconnect) / ready (AOD-67 Pills). Stores the stable id(s), never the label.
 *  The ready state wraps the Pills in a per-field testID View so a schema with two remote fields keeps its
 *  options addressable (the AOD-67 Pills namespaces segments as `pill-<value>`). */
function RemoteOptions({
  field,
  value,
  onChange,
  state,
  serviceName,
  onReconnect,
}: {
  field: Extract<WidgetConfigField, { kind: 'remote-options' }>;
  value: unknown;
  onChange(value: unknown): void;
  state?: ResolvedOptionsState;
  serviceName?: string;
  onReconnect?: () => void;
}) {
  if (!state || state.status === 'loading') {
    return (
      <Text style={styles.muted} testID={`config-remote-loading-${field.key}`}>
        Loading options...
      </Text>
    );
  }

  if (state.status === 'needs_reconnect') {
    return (
      <View style={styles.prompt} testID={`config-remote-reconnect-${field.key}`}>
        <Text style={styles.muted}>Reconnect {serviceName ?? 'the service'} to choose options.</Text>
        {onReconnect && (
          <Pressable onPress={onReconnect} accessibilityRole="button">
            <Text style={styles.actionLink}>Reconnect</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View style={styles.prompt} testID={`config-remote-error-${field.key}`}>
        <Text style={styles.muted}>Could not load options.</Text>
        <Pressable onPress={state.retry} accessibilityRole="button">
          <Text style={styles.actionLink}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (state.choices.length === 0) {
    return (
      <Text style={styles.muted} testID={`config-remote-empty-${field.key}`}>
        No options available.
      </Text>
    );
  }

  const multiple = field.multiple === true;
  const selectedArray = Array.isArray(value) ? (value as string[]) : [];
  const selected = multiple ? selectedArray : value != null && value !== '' ? [value as string] : [];

  const onToggle = (optValue: string) => {
    if (multiple) {
      onChange(
        selectedArray.includes(optValue)
          ? selectedArray.filter((v) => v !== optValue)
          : [...selectedArray, optValue],
      );
    } else {
      onChange(optValue);
    }
  };

  return (
    <View testID={`config-remote-${field.key}`}>
      <Pills options={state.choices} selected={selected} onToggle={onToggle} testID={`config-remote-pills-${field.key}`} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.spacing(3),
  },
  title: {
    ...theme.type.title,
    color: theme.colors.text,
  },
  field: {
    gap: theme.spacing(1.5),
  },
  // §7 the field label: the AOD-67 input-label convention (type.caption / textMuted, uppercase).
  label: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  req: {
    color: theme.colors.error,
  },
  muted: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
  },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  actionLink: {
    ...theme.type.meta,
    fontWeight: '600',
    color: theme.colors.accent,
  },
  // §7 inline field errors: type.meta / error.
  error: {
    ...theme.type.meta,
    color: theme.colors.error,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(3),
    paddingTop: theme.spacing(2),
  },
}));
