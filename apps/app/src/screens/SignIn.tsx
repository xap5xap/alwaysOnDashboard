// The Sign In interior (design-onboarding-screens.md §3, AOD-29). The (auth) zone has ONE surface, so
// sign-up is a MODE of this card, not a second screen: the "Create an account" action toggles the card
// between sign-in and sign-up (the subtitle, the primary label, and the toggle swap; the fields are
// unchanged), serving both signInWithPassword and signUpWithPassword. Composes the AOD-67 AuthCard +
// Wordmark + Input + Button; busy is the in-button spinner (AOD-21 §8), error is a quiet type.meta /
// colors.error line above the primary (not an alert). AOD-21 §12 placed the card in the (auth) zone; this
// fills the form only.
//
// AOD-29 §10 canonicalization of the shipped SignIn: the 32/800 brand text -> the vela Wordmark (drift 1);
// the ad-hoc TextInputs -> the AOD-67 Input (drift 2); the colors.background primary label -> onAccent, via
// the Button's primary variant (drift 3); the always-visible "Create an account" -> the mode toggle
// (drift 4); the error / busy kept and themed (drift 5); the Supabase-not-configured warning kept as a dev
// affordance (drift 6).
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAuth } from '../auth/AuthProvider';
import { isSupabaseConfigured } from '../supabase/env';
import { AuthCard, Wordmark } from '../ui/Surfaces';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

type Mode = 'sign-in' | 'sign-up';

export function SignIn() {
  const { signInWithPassword, signUpWithPassword } = useAuth();
  const { theme } = useUnistyles();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'sign-up';

  async function submit() {
    setBusy(true);
    setError(null);
    const fn = isSignUp ? signUpWithPassword : signInWithPassword;
    const result = await fn(email.trim(), password);
    if (result.error) setError(result.error);
    setBusy(false);
  }

  function toggleMode() {
    setMode(isSignUp ? 'sign-in' : 'sign-up');
    setError(null);
  }

  const primaryLabel = isSignUp
    ? busy
      ? 'Creating account'
      : 'Create account'
    : busy
      ? 'Signing in'
      : 'Sign in';

  return (
    <View style={styles.screen}>
      <AuthCard testID="signin-card">
        <Wordmark />
        <Text style={[theme.type.body, styles.subtitle]}>
          {isSignUp ? 'Create your account' : 'Sign in to your dashboard'}
        </Text>

        {!isSupabaseConfigured && (
          <Text style={[theme.type.meta, styles.warn]} testID="signin-config-warning">
            Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
          </Text>
        )}

        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          accessibilityLabel="Email"
          testID="signin-email"
        />
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          hint={isSignUp ? 'At least 6 characters.' : undefined}
          accessibilityLabel="Password"
          testID="signin-password"
        />

        {error ? (
          <Text style={[theme.type.meta, styles.error]} testID="signin-error">
            {error}
          </Text>
        ) : null}

        <Button
          label={primaryLabel}
          variant="primary"
          block
          loading={busy}
          onPress={submit}
          testID="signin-submit"
        />
        <Button
          label={isSignUp ? 'Sign in instead' : 'Create an account'}
          variant="ghost"
          block
          disabled={busy}
          onPress={toggleMode}
          testID="signin-toggle-mode"
        />
      </AuthCard>
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
  subtitle: {
    color: theme.colors.textMuted,
  },
  warn: {
    color: theme.colors.warning,
  },
  error: {
    color: theme.colors.error,
  },
}));
