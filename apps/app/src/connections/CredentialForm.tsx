// The generic non-OAuth connect form (AOD-8 §10: render from the class, never the service). It serves
// both non-OAuth mechanisms by dispatching on the mechanism, NOT the service, so any future api_key or
// platform_key integration reuses it as-is:
//   - `key` (api_key/admin_key): a secret field, submitted as { apiKey } (AOD-9 §7.2). Unchanged.
//   - `location` (platform_key, e.g. Weather): a keyless city geocoding search; picking a result submits
//     the coordinate { location } the /v1/forecast API consumes (integration-weather.md §5.2/§5.3).
//
// AOD-70 recompose (design-settings-connections.md §6, §10 drift 2/3): this is the SHEET INTERIOR now,
// composed from the AOD-67 controls instead of ad-hoc TextInput/Pressable. The `key` interior is one AOD-67
// `Input` (secureTextEntry, surfaceAlt fill + placeholder -> textMuted owned by the component) with a ghost
// Cancel + a primary Save Button; the `location` interior is the AOD-67 `SearchRow` (§6) whose results
// render as an elevation.raised RowGroup of ListRows (§8), with a ghost Cancel. The sheet CHROME (scrim +
// elevation.overlay + grabber) is CredentialSheet's; this stays the pure interior, unchanged in props.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button, Input, ListRow, RowGroup, SearchRow } from '../ui';
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

/** api_key / admin_key: a single AOD-67 secret Input, submitted as { apiKey } (AOD-9 §7.2). The key is
 *  high-sensitivity (AOD-9 §4): never logged or returned, so the field serves both classes with one
 *  interior and Settings shows only a masked hint after connect. */
function KeyForm({ pending, error, onSubmit, onCancel }: CredentialFormProps) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !pending;

  const submit = () => {
    if (canSubmit) onSubmit({ apiKey: trimmed });
  };

  return (
    <View style={styles.form} testID="credential-form">
      <Input
        label="API key"
        value={value}
        onChangeText={setValue}
        placeholder="Paste your key"
        hint="Stored securely. Never shown again."
        error={error}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        disabled={pending}
        returnKeyType="done"
        onSubmitEditing={submit}
        accessibilityLabel="API key"
        testID="credential-form-key"
      />
      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={pending} testID="credential-form-cancel" />
        <Button
          label="Save"
          variant="primary"
          onPress={submit}
          loading={pending}
          disabled={trimmed.length === 0}
          testID="credential-form-submit"
        />
      </View>
    </View>
  );
}

/**
 * platform_key (Weather): type a city, search Open-Meteo's keyless geocoding API, then pick a result.
 * Picking submits { location: { latitude, longitude, timezone, name } } (integration-weather.md §5.2),
 * the coordinate shape the forecast API consumes. `pending` is the connect mutation (credentials-store);
 * `searching` is the geocoding lookup, kept separate so a failed search never blocks Cancel. The pick is
 * the submit, so the only button is Cancel (design-settings-connections.md §6).
 */
function LocationForm({ pending, error, onSubmit, onCancel }: CredentialFormProps) {
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
      <SearchRow
        label="Location"
        value={query}
        onChangeText={setQuery}
        placeholder="City, e.g. Quito"
        autoCapitalize="words"
        autoCorrect={false}
        disabled={pending}
        accessibilityLabel="Location"
        searching={searching}
        searchDisabled={!canSearch}
        onSearch={search}
      />

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
        <RowGroup testID="location-results">
          {results.map((r, i) => (
            <Pressable
              key={`${r.id}-${i}`}
              onPress={() => pick(r)}
              accessibilityRole="button"
              accessibilityLabel={geocodeLabel(r)}
              disabled={pending}
              testID={`location-result-${i}`}
            >
              <ListRow title={geocodeLabel(r)} />
            </Pressable>
          ))}
        </RowGroup>
      )}

      {error && (
        <Text style={styles.error} testID="credential-form-error">
          {error}
        </Text>
      )}

      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={pending} testID="credential-form-cancel" />
        {pending && <Text style={styles.hintText}>Saving...</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.spacing(3),
  },
  hintText: {
    ...theme.type.meta,
    color: theme.colors.textMuted,
  },
  error: {
    ...theme.type.meta,
    color: theme.colors.error,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing(3),
    alignItems: 'center',
  },
}));
