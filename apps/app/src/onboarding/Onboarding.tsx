// The onboarding first-run sequence (design-onboarding-screens.md §4/§5, AOD-29). A guided-but-skippable
// three-step flow the gate routes a signed-in, not-yet-onboarded user to (app-ia §4.2). It COMPOSES the
// AOD-70 connections surface for the connect step (ConnectionsList + its rows + connect paths + credential
// sheet, NOT redrawn) and the AOD-68 shell (Screen + ScreenBody). Finishing or skipping sets the onboarded
// flag (setOnboarded) and REPLACES into the Dashboard (app-ia §6.1), so the OS back never returns into a
// completed onboarding, and the AOD-27 §5 empty dashboard takes over from there.
//
//   welcome  the vela wordmark + "Always on. Never loud." tagline · Get started / Skip for now
//   connect  "Connect your first service." + the calm empty line · the AOD-70 rows · Skip for now
//   finish   the §5.1 success check + "You are set." + the connected service · Go to dashboard / Connect another
//
// The two empties, two owners rule (§5): the connect-step empty is AOD-29's calm CTA (here); the dashboard
// empty is AOD-27 §5 (finished into, not redrawn). Neither is an error treatment.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { ConnectionsList } from '../connections/ConnectionsList';
import { useConnections } from '../connections/useConnections';
import { useRegistry } from '../registry/RegistryProvider';
import { Screen, ScreenBody } from '../shell';
import { Button } from '../ui/Button';
import { Wordmark } from '../ui/Surfaces';
import { CheckGlyph } from '../ui/glyphs';
import { setOnboarded } from './onboardedStore';
import { Stepper } from './Stepper';

type Step = 'welcome' | 'connect' | 'finish';
const STEP_INDEX: Record<Step, number> = { welcome: 0, connect: 1, finish: 2 };

export function Onboarding() {
  const { theme } = useUnistyles();
  const registry = useRegistry();
  const { connections } = useConnections();
  const [step, setStep] = useState<Step>('welcome');
  const [connectedName, setConnectedName] = useState<string | null>(null);
  // The connected services present when the connect step is entered; a user who already has connections is
  // not auto-advanced (only a NEW connection during onboarding advances). A brand-new user's baseline is empty.
  const baselineRef = useRef<Set<string> | null>(null);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of registry.connectableServices()) map.set(s.id, s.displayName);
    return map;
  }, [registry]);

  const connectedIds = useMemo(() => {
    const ids: string[] = [];
    for (const v of connections.values()) if (v.status === 'connected') ids.push(v.service);
    return ids.sort();
  }, [connections]);
  const connectedKey = connectedIds.join(',');

  // Finishing or skipping: persist the onboarded flag (app-ia §4.2 seam) and replace into the Dashboard.
  const finish = () => {
    setOnboarded(true);
    router.replace('/dashboard');
  };

  const goConnect = () => {
    baselineRef.current = new Set(connectedIds);
    setStep('connect');
  };

  // Advance to the success step when a service connects during onboarding (the AOD-70 credential sheet /
  // OAuth round-trip invalidates the connections query, so this reacts to the fresh `connected` row).
  useEffect(() => {
    if (step !== 'connect' || baselineRef.current === null) return;
    const fresh = connectedIds.find((id) => !baselineRef.current!.has(id));
    if (fresh) {
      setConnectedName(nameById.get(fresh) ?? fresh);
      setStep('finish');
    }
    // connectedKey is the stable projection of connectedIds the effect depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedKey, step]);

  return (
    <Screen testID="onboarding">
      <Stepper index={STEP_INDEX[step]} count={3} />
      {step === 'connect' ? (
        <ScreenBody testID="onboarding-connect">
          <View style={styles.connectHead}>
            <Text style={[theme.type.title, styles.text]}>Connect your first service.</Text>
            <Text style={[theme.type.meta, styles.muted]}>Nothing connected yet. Pick one to begin.</Text>
          </View>
          <ConnectionsList heading={null} />
          <Button label="Skip for now" variant="ghost" block onPress={finish} testID="onboarding-skip" />
        </ScreenBody>
      ) : (
        <ScreenBody scroll={false}>
          <View style={styles.centered} testID={step === 'welcome' ? 'onboarding-welcome' : 'onboarding-finish'}>
            {step === 'welcome' ? (
              <>
                <Wordmark />
                <Text style={[theme.type.body, styles.tagline]}>Always on. Never loud.</Text>
                <View style={styles.actions}>
                  <Button label="Get started" variant="primary" block onPress={goConnect} testID="onboarding-get-started" />
                  <Button label="Skip for now" variant="ghost" block onPress={finish} testID="onboarding-skip" />
                </View>
              </>
            ) : (
              <>
                <SuccessCheck />
                <Text style={[theme.type.title, styles.text]}>You are set.</Text>
                <Text style={[theme.type.meta, styles.muted]}>
                  {connectedName ? `${connectedName} connected.` : 'Your first service is connected.'}
                </Text>
                <View style={styles.actions}>
                  <Button label="Go to dashboard" variant="primary" block onPress={finish} testID="onboarding-go-dashboard" />
                  <Button label="Connect another" variant="ghost" block onPress={goConnect} testID="onboarding-connect-another" />
                </View>
              </>
            )}
          </View>
        </ScreenBody>
      )}
    </Screen>
  );
}

/** The §5.1 renderer-drawn success mark: the shared check glyph (accent) in a soft accentMuted disc. */
function SuccessCheck() {
  const { theme } = useUnistyles();
  return (
    <View
      testID="onboarding-success-check"
      style={{ width: 56, height: 56, borderRadius: theme.radius.full, backgroundColor: theme.colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}
    >
      <CheckGlyph color={theme.colors.accent} size={28} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing(3) },
  connectHead: { gap: theme.spacing(1) },
  text: { color: theme.colors.text, textAlign: 'center' },
  muted: { color: theme.colors.textMuted, textAlign: 'center' },
  tagline: { color: theme.colors.textMuted, textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: theme.spacing(2), marginTop: theme.spacing(2) },
}));
