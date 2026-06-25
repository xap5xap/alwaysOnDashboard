// The generic non-OAuth connect form (AOD-8 §10: render from the class, never the service). One
// component serves both non-OAuth mechanisms: `key` (api_key/admin_key -> a secret field, sent as
// { apiKey }) and `location` (platform_key -> a plain field, sent as { location: { city } } per
// AOD-9 §5.1). It is NOT per-service: any future api_key or platform_key integration reuses it as-is.
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { ConnectMechanism } from './affordance';

export interface CredentialFormProps {
  mechanism: Extract<ConnectMechanism, 'key' | 'location'>;
  pending: boolean;
  error: string | null;
  onSubmit(payload: { apiKey?: string; location?: Record<string, unknown> }): void;
  onCancel(): void;
}

const COPY: Record<CredentialFormProps['mechanism'], { label: string; placeholder: string; secure: boolean }> = {
  key: { label: 'API key', placeholder: 'Paste your key', secure: true },
  location: { label: 'Location', placeholder: 'City, e.g. Quito', secure: false },
};

export function CredentialForm({ mechanism, pending, error, onSubmit, onCancel }: CredentialFormProps) {
  const [value, setValue] = useState('');
  const copy = COPY[mechanism];
  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !pending;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(mechanism === 'key' ? { apiKey: trimmed } : { location: { city: trimmed } });
  };

  return (
    <View style={styles.form} testID="credential-form">
      <Text style={styles.label}>{copy.label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={copy.placeholder}
        placeholderTextColor="#6B7280"
        secureTextEntry={copy.secure}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!pending}
        accessibilityLabel={copy.label}
        onSubmitEditing={submit}
      />
      {error && (
        <Text style={styles.error} testID="credential-form-error">
          {error}
        </Text>
      )}
      <View style={styles.actions}>
        <Pressable onPress={onCancel} accessibilityRole="button" disabled={pending}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          disabled={!canSubmit}
          testID="credential-form-submit"
        >
          <Text style={[styles.submit, !canSubmit && styles.submitDisabled]}>
            {pending ? 'Saving...' : 'Save'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.spacing(2),
    paddingTop: theme.spacing(2),
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    fontSize: 15,
  },
  error: {
    color: theme.colors.error,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing(4),
    alignItems: 'center',
  },
  cancel: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  submit: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  submitDisabled: {
    color: theme.colors.textMuted,
  },
}));
