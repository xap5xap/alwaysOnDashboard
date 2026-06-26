// The generic per-instance config form (AOD-10 §4.1 field kinds, §4.2 validation place 1; AOD-8 §10
// "Config form UI: renders a form from WidgetConfigSchema. Generic over field kinds."). Pure and
// presentational like WidgetHostView: it renders one input per STATIC field kind (string / number /
// boolean / enum) from a WidgetConfigSchema, pre-filled from the instance's current config, validates
// on save with the EXISTING validateConfig (never a second validator), surfaces field-level errors, and
// hands the caller the normalized values. It names no service and reads no registry beyond the schema
// it is given, so it works for every widget. Persistence and the entry-point wiring live elsewhere
// (dashboardRepo / the picker / the dashboard); this component only collects and validates.
//
// remote-options (AOD-10 §4.3) is OUT OF SCOPE here: it needs the server-side option-source allow-list
// and a config-time proxy call that arrive with the Linear slice (PS-M3). Such a field renders as a
// read-only note and its pre-existing value is carried through untouched, so the form never crashes and
// reconfiguring other fields never erases a remote selection.
import React, { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { WidgetConfigField, WidgetConfigSchema } from '../registry/types';
import { validateConfig } from './config';

export interface ConfigFormProps {
  schema: WidgetConfigSchema;
  /** The instance's current config (or the schema defaults on configure-on-add). Pre-fills the inputs. */
  initial: Record<string, unknown>;
  title: string;
  submitLabel?: string;
  pending?: boolean;
  /** A persist failure surfaced by the caller; field-level validation errors are owned here. */
  submitError?: string | null;
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
    default:
      return value; // remote-options: carry the existing selection through untouched
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
      default:
        if (v !== undefined) out[field.key] = v; // remote-options: pass the carried value through
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
  onSubmit,
  onCancel,
}: ConfigFormProps) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => seedDraft(schema, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));

  const onSave = () => {
    const result = validateConfig(schema, coerceForValidation(schema, draft));
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
          <Field field={field} value={draft[field.key]} onChange={(v) => setField(field.key, v)} />
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
}: {
  field: WidgetConfigField;
  value: unknown;
  onChange(value: unknown): void;
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
    default:
      // remote-options (AOD-10 §4.3): not resolvable until the integration lands (PS-M3).
      return (
        <Text style={styles.muted} testID={`config-remote-${field.key}`}>
          Choosing options needs the connected integration (coming with the first provider).
        </Text>
      );
  }
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
