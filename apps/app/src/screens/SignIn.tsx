// Minimal email/password sign-in (AOD-24 onboarding is PS-M3). Sign-up is included so a dev user can
// be created against the local Supabase stack. Once a session exists, AuthProvider flips the app to
// the dashboard (app/index.tsx gate).
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured } from '../supabase/env';

export function SignIn() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const { theme } = useUnistyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(kind: 'sign-in' | 'sign-up') {
    setBusy(true);
    setError(null);
    const fn = kind === 'sign-in' ? signInWithPassword : signUpWithPassword;
    const result = await fn(email.trim(), password);
    if (result.error) setError(result.error);
    setBusy(false);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.brand}>Vela</Text>
        <Text style={styles.subtitle}>Sign in to your dashboard</Text>

        {!isSupabaseConfigured && (
          <Text style={styles.warn}>
            Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
          </Text>
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          accessibilityLabel="Email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          accessibilityLabel="Password"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.primary} disabled={busy} onPress={() => submit('sign-in')} accessibilityRole="button">
          {busy ? <ActivityIndicator color={theme.colors.background} /> : <Text style={styles.primaryText}>Sign in</Text>}
        </Pressable>
        <Pressable disabled={busy} onPress={() => submit('sign-up')} accessibilityRole="button">
          <Text style={styles.secondary}>Create an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(5),
    paddingTop: rt.insets.top + theme.spacing(5),
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(6),
    gap: theme.spacing(3),
  },
  brand: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 14,
    marginBottom: theme.spacing(2),
  },
  warn: {
    color: theme.colors.warning,
    fontSize: 12,
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(3),
    color: theme.colors.text,
    fontSize: 15,
  },
  error: {
    color: theme.colors.error,
    fontSize: 13,
  },
  primary: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing(3),
    alignItems: 'center',
    marginTop: theme.spacing(1),
  },
  primaryText: {
    color: theme.colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
  secondary: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
}));
