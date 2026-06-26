// The generic per-instance config form (AOD-10 §4.1 field kinds, §4.2 validation place 1; AOD-8 §10
// "Config form UI: renders a form from WidgetConfigSchema. Generic over field kinds."). Pure and
// presentational like WidgetHostView: it renders one input per STATIC field kind (string / number /
// boolean / enum) from a WidgetConfigSchema, pre-filled from the instance's current config, validates
// on save with the EXISTING validateConfig (never a second validator), surfaces field-level errors, and
// hands the caller the normalized values. It names no service and reads no registry beyond the schema
// it is given, so it works for every widget. Persistence and the entry-point wiring live elsewhere
// (dashboardRepo / the picker / the dashboard); this component only collects and validates.
//
// remote-options (AOD-10 §4.3) is resolved by the caller (useOptionSources) and passed in via
// `options`: a real picker fed by the resolved Choice[] (single or multiple per field.multiple),
// storing the stable id(s). On save the ready sets are passed to validateConfig so membership is
// enforced when available and unverified when not (§4.2 rule 2). This component stays pure: the
// network lives in the hook at the entry points.
import React, { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Choice, WidgetConfigField, WidgetConfigSchema } from '../registry/types';
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
    const result = validateConfig(schema, coerceForValidation(schema, draft), resolvedOptions);
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
        <Pressable onPress={onCancel} accessibilityRole="button" testID="config-cancel">
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={pending}
          accessibilityRole="button"
          testID="config-submit"
          style={styles.submit}
        >
          <Text style={styles.submitText}>{pending ? '...' : submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** One input, switched on the field kind. Generic: it never names a service or a specific field. */
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
      return (
        <TextInput
          style={styles.input}
          value={typeof value === 'string' ? value : value == null ? '' : String(value)}
          onChangeText={onChange}
          placeholder={field.kind === 'string' ? field.placeholder : undefined}
          placeholderTextColor="#7A7F8C"
          keyboardType={field.kind === 'number' ? 'numeric' : 'default'}
          testID={`config-field-${field.key}`}
        />
      );
    case 'boolean':
      return (
        <Switch
          value={value === true}
          onValueChange={onChange}
          testID={`config-switch-${field.key}`}
        />
      );
    case 'enum':
      return (
        <View style={styles.options}>
          {field.options.map((opt) => {
            const selected = value === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => onChange(opt.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`config-enum-${field.key}-${opt.value}`}
                style={[styles.pill, selected && styles.pillSelected]}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
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
 *  (retry) / needs_reconnect (reconnect) / ready (pills). Stores the stable id(s), never the label. */
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

  const toggle = (optValue: string) => {
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
    <View style={styles.options}>
      {state.choices.map((opt: Choice) => {
        const selected = multiple ? selectedArray.includes(opt.value) : value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => toggle(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            testID={`config-remote-${field.key}-${opt.value}`}
            style={[styles.pill, selected && styles.pillSelected]}
          >
            <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.spacing(3),
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  field: {
    gap: theme.spacing(1.5),
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  req: {
    color: theme.colors.error,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2.5),
    color: theme.colors.text,
    fontSize: 15,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  pill: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
  },
  pillSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  pillText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pillTextSelected: {
    color: theme.colors.background,
  },
  muted: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
  },
  actionLink: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    color: theme.colors.error,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(4),
    paddingTop: theme.spacing(2),
  },
  cancel: {
    color: theme.colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  submit: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(5),
    paddingVertical: theme.spacing(2.5),
  },
  submitText: {
    color: theme.colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
}));
