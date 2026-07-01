// The paywall body (design-onboarding-screens.md §6/§7, AOD-29). The shared destination of every Pro-gated
// action (app-ia §5 row 13; the Gate fallback). It COMPOSES the AOD-67 Sheet (scrim + elevation.overlay
// surfaceAlt + grabber) for the AOD-21 §7 modal presentation and fills the body only: the 7-day-trial lead
// (per-trigger, §7), the value props (the AOD-12 §4 levers as an accent-checked list), the annual + monthly
// packages (annual selected = accentMuted + accent border + a SAVE 44% badge), the "Start 7-day free trial"
// CTA, "Restore purchases" (store-required), and "Maybe later". The purchase / restore run through the real
// RevenueCat seam; a success flips CustomerInfo (via the PurchasesBridge) so the Gate locks fall away without
// a restart (AOD-12 §6.5), and the modal dismisses to the unchanged caller. The math / price / triggers are
// AOD-12's; this places how they read. No new token (accentMuted + the SAVE badge are AOD-67's).
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, UnistylesRuntime, useUnistyles } from 'react-native-unistyles';
import { AccentBadge, Button, CheckGlyph, CloseGlyph, Sheet } from '../ui';
import { purchases } from '../entitlements/purchases';
import { DEFAULT_PACKAGES, type PackageId, type PaywallPackage } from '../entitlements/purchases.types';
import { PRO_VALUE_PROPS, leadForTrigger } from './triggerLeads';

export function Paywall() {
  const { theme } = useUnistyles();
  const { trigger } = useLocalSearchParams<{ trigger?: string }>();
  const [packages, setPackages] = useState<PaywallPackage[]>(DEFAULT_PACKAGES);
  const [selected, setSelected] = useState<PackageId>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismiss = () => router.back();

  // Load the live offering packages (falls back to the AOD-12 defaults when no offering is configured).
  useEffect(() => {
    let alive = true;
    void purchases.getPackages().then((pkgs) => {
      if (alive && pkgs.length) setPackages(pkgs);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function startTrial() {
    setPurchasing(true);
    setError(null);
    try {
      await purchases.purchase(selected);
      // The PurchasesBridge listener flips CustomerInfo -> PRO; dismiss to the now-unlocked caller.
      dismiss();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPurchasing(false);
    }
  }

  async function restore() {
    setRestoring(true);
    setError(null);
    try {
      const result = await purchases.restore();
      if (result.activeEntitlementIds.length > 0) dismiss();
      else setError('No purchases to restore.');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setRestoring(false);
    }
  }

  const busy = purchasing || restoring;

  return (
    <Sheet visible onRequestClose={dismiss} bottomInset={UnistylesRuntime.insets.bottom} testID="paywall">
      <View style={styles.header}>
        <Text style={[theme.type.title, styles.text]} testID="paywall-title">
          Vela Pro
        </Text>
        <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} testID="paywall-close">
          <CloseGlyph color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={[theme.type.body, styles.lead]} testID="paywall-lead">
          {leadForTrigger(trigger)}
        </Text>

        <View style={styles.props} testID="paywall-value-props">
          {PRO_VALUE_PROPS.map((prop) => (
            <View key={prop} style={styles.propRow}>
              <CheckGlyph color={theme.colors.accent} />
              <Text style={[theme.type.body, styles.text]}>{prop}</Text>
            </View>
          ))}
        </View>

        <View style={styles.packages}>
          {packages.map((pkg) => (
            <PackageRow key={pkg.id} pkg={pkg} selected={selected === pkg.id} onSelect={() => setSelected(pkg.id)} />
          ))}
        </View>

        {error ? (
          <Text style={[theme.type.meta, styles.error]} testID="paywall-error">
            {error}
          </Text>
        ) : null}

        <View style={styles.ctas}>
          <Button
            label="Start 7-day free trial"
            variant="primary"
            block
            loading={purchasing}
            disabled={busy}
            onPress={startTrial}
            testID="paywall-start-trial"
          />
          <Button
            label="Restore purchases"
            variant="ghost"
            block
            loading={restoring}
            disabled={busy}
            onPress={restore}
            testID="paywall-restore"
          />
          <Pressable onPress={dismiss} disabled={busy} accessibilityRole="button" testID="paywall-maybe-later">
            <Text style={[theme.type.meta, styles.maybeLater]}>Maybe later</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Sheet>
  );
}

/** A selectable package row: selected uses the soft accentMuted fill + accent border (AOD-20 §7); the annual
 *  carries the SAVE 44% badge (AOD-12 §5.1). Colours are resolved in-component (the computed-role pitfall). */
function PackageRow({ pkg, selected, onSelect }: { pkg: PaywallPackage; selected: boolean; onSelect: () => void }) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={`paywall-package-${pkg.id}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(2),
        padding: theme.spacing(3),
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: selected ? theme.colors.accent : theme.colors.border,
        backgroundColor: selected ? theme.colors.accentMuted : 'transparent',
      }}
    >
      <View style={{ gap: theme.spacing(0.5) }}>
        <Text style={{ ...theme.type.title, color: theme.colors.text }}>{pkg.id === 'annual' ? 'Annual' : 'Monthly'}</Text>
        <Text style={{ ...theme.type.meta, color: theme.colors.textMuted }}>
          {pkg.priceString} / {pkg.period} · 7-day free trial
        </Text>
      </View>
      {pkg.id === 'annual' ? <AccentBadge label="SAVE 44%" /> : null}
    </Pressable>
  );
}

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Something went wrong. Try again.';
}

const styles = StyleSheet.create((theme) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing(2) },
  text: { color: theme.colors.text },
  lead: { color: theme.colors.textMuted, marginBottom: theme.spacing(4) },
  props: { gap: theme.spacing(2.5), marginBottom: theme.spacing(4) },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  packages: { gap: theme.spacing(2) },
  error: { color: theme.colors.error, marginTop: theme.spacing(3) },
  ctas: { gap: theme.spacing(2), marginTop: theme.spacing(4) },
  maybeLater: { color: theme.colors.textMuted, textAlign: 'center', paddingVertical: theme.spacing(2) },
}));
