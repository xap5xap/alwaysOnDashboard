// The generic non-OAuth connect form (AOD-8 §10: render from the class, never the service). It serves
// both non-OAuth mechanisms by dispatching on the mechanism, NOT the service, so any future api_key or
// platform_key integration reuses it as-is:
//   - `key` (api_key/admin_key): a secret field, submitted as { apiKey } (AOD-9 §7.2). Unchanged.
//   - `location` (platform_key, e.g. Weather): a keyless city geocoding search; picking a result submits
//     the coordinate { location } the /v1/forecast API consumes (integration-weather.md §5.2/§5.3). This
//     replaces the prior free-text { city } placeholder, because the forecast API cannot consume a bare
//     city. A richer onboarding picker is AOD-26; this is the minimal capture the build owns (§10).
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { ConnectMechanism } from './affordance';
import { geocodeLabel, type GeocodeResult, searchLocations, toWeatherLocation } from './geocoding';

export interface CredentialFormProps {
  mechanism: Extract<ConnectMechanism, 'key' | 'location'>;
  pending: boolean;
  error: string | null;
  onSubmit(payload: { apiKey?: string; location?: Record<string, unknown> }): void;
  onCancel(): void;
}

export function CredentialForm(props: CredentialFormProps) {
  return props.mechanism === 'location' ? <LocationForm {...props} /> : <KeyForm {...props} />;
}

/** api_key / admin_key: a single secret field, submitted as { apiKey } (AOD-9 §7.2). */
function KeyForm({ pending, error, onSubmit, onCancel }: CredentialFormProps) {
  const { theme } = useUnistyles();
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !pending;

  const submit = () => {
    if (canSubmit) onSubmit({ apiKey: trimmed });
  };

  return (
    <View style={styles.form} testID="credential-form">
      <Text style={styles.label}>API key</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder="Paste your key"
        placeholderTextColor={theme.colors.textMuted} // §13 drift 3: was the hardcoded #6B7280
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        editable={!pending}
        accessibilityLabel="API key"
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
        <Pressable onPress={submit} accessibilityRole="button" disabled={!canSubmit} testID="credential-form-submit">
          <Text style={[styles.submit, !canSubmit && styles.submitDisabled]}>{pending ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * platform_key (Weather): type a city, search Open-Meteo's keyless geocoding API, then pick a result.
 * Picking submits { location: { latitude, longitude, timezone, name } } (integration-weather.md §5.2),
 * the coordinate shape the forecast API consumes. `pending` is the connect mutation (credentials-store);
 * `searching` is the geocoding lookup, kept separate so a failed search never blocks Cancel.
 */
function LocationForm({ pending, error, onSubmit, onCancel }: CredentialFormProps) {
  const { theme } = useUnistyles();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const trimmed = query.trim();
  const canSearch = trimmed.length > 0 && !searching && !pending;

  const search = async () => {
    if (!canSearch) return;
    setSearching(true);
    setSearchError(null);
    setResults(null);
    try {
      setResults(await searchLocations(trimmed));
    } catch {
      setSearchError('Could not search locations. Try again.');
    } finally {
      setSearching(false);
    }
  };

  const pick = (r: GeocodeResult) => {
    // Spread into a fresh object literal so the typed WeatherLocation satisfies the generic
    // { location?: Record<string, unknown> } payload (AOD-9 §7.2); the broker stores it verbatim.
    if (!pending) onSubmit({ location: { ...toWeatherLocation(r) } });
  };

  return (
    <View style={styles.form} testID="credential-form">
      <Text style={styles.label}>Location</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          value={query}
          onChangeText={setQuery}
          placeholder="City, e.g. Quito"
          placeholderTextColor={theme.colors.textMuted} // §13 drift 3: was the hardcoded #6B7280
          autoCapitalize="words"
          autoCorrect={false}
          editable={!pending}
          accessibilityLabel="Location"
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <Pressable onPress={search} accessibilityRole="button" disabled={!canSearch} testID="location-search-submit">
          <Text style={[styles.submit, !canSearch && styles.submitDisabled]}>{searching ? '...' : 'Search'}</Text>
        </Pressable>
      </View>

      {searching && (
        <View style={styles.searchHint}>
          <ActivityIndicator />
          <Text style={styles.hintText}>Searching...</Text>
        </View>
      )}
      {searchError && (
        <Text style={styles.error} testID="location-search-error">
          {searchError}
        </Text>
      )}
      {results && results.length === 0 && !searching && (
        <Text style={styles.hintText} testID="location-no-results">
          No matches. Try a different city.
        </Text>
      )}

      {results && results.length > 0 && (
        <View style={styles.results} testID="location-results">
          {results.map((r, i) => (
            <Pressable
              key={`${r.id}-${i}`}
              onPress={() => pick(r)}
              accessibilityRole="button"
              accessibilityLabel={geocodeLabel(r)}
              disabled={pending}
              testID={`location-result-${i}`}
            >
              <Text style={styles.resultText}>{geocodeLabel(r)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {error && (
        <Text style={styles.error} testID="credential-form-error">
          {error}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable onPress={onCancel} accessibilityRole="button" disabled={pending}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        {pending && <Text style={styles.hintText}>Saving...</Text>}
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
    backgroundColor: theme.colors.surfaceAlt, // §13 drift 2: one input fill (was background)
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(2),
    fontSize: 15,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
  },
  searchInput: {
    flexGrow: 1,
    flexShrink: 1,
  },
  searchHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  hintText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  results: {
    gap: theme.spacing(1),
  },
  resultText: {
    color: theme.colors.text,
    fontSize: 15,
    paddingVertical: theme.spacing(2),
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
