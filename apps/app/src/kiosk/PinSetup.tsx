// The first-run exit-PIN setup (AOD-73, kiosk-mode.md §4.3). AOD-72 shipped a dev-default exit PIN; production
// must not ship it, and the native runtime reads the configured PIN hash from expo-secure-store. This is the
// minimal owner-facing surface that WRITES that hash: on the first kiosk entry with no PIN stored
// (runtime.needsPinSetup), the wall shows this "set exit PIN" pad (enter then confirm) and calls onDone(pin),
// which the runtime hashes + persists. Reuses the shared PinPad. This is NOT the full kiosk-entry config (that
// chrome is AOD-21/68, out of scope); it is the exit-guard's own bootstrap so a wall is never left un-exitable.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { Button, Modal } from '../ui';
import { PIN_LENGTH, appendDigit, deleteDigit } from './pin';
import { PinPad } from './PinPad';

export interface PinSetupProps {
  /** A confirmed 4-digit PIN: the caller hashes + persists it (runtime.setPin). */
  onDone(pin: string): void;
  /** Leave the wall without setting a PIN, so the owner is never trapped before setup (calls the exit path). */
  onCancel(): void;
}

export function PinSetup({ onDone, onCancel }: PinSetupProps) {
  const { theme } = useUnistyles();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [entry, setEntry] = useState('');
  const [mismatch, setMismatch] = useState(0); // increments on a confirm mismatch, to re-run the shake

  // Re-run a short translateX wobble whenever a confirm mismatches (mirrors the ExitAffordance §7 shake).
  const shakeX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (mismatch === 0) return;
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: 6, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: false }),
    ]).start();
  }, [mismatch, shakeX]);

  const onKey = (digit: string) => {
    const next = appendDigit(entry, digit);
    if (next.length < PIN_LENGTH) {
      setEntry(next);
      return;
    }
    if (step === 'enter') {
      // first entry captured; move to confirm.
      setFirst(next);
      setEntry('');
      setStep('confirm');
    } else if (next === first) {
      // confirmed: hand the plaintext up; the caller hashes + persists it.
      setEntry('');
      onDone(next);
    } else {
      // mismatch: shake and restart from the first entry (never persist a guessed pair).
      setEntry('');
      setFirst('');
      setStep('enter');
      setMismatch((n) => n + 1);
    }
  };

  const title = step === 'enter' ? 'Set exit PIN' : 'Confirm exit PIN';
  const sub =
    mismatch > 0 && step === 'enter'
      ? 'PINs did not match. Try again.'
      : step === 'enter'
        ? 'Choose a 4-digit PIN to exit the wall.'
        : 'Re-enter your PIN to confirm.';

  return (
    <Modal visible onRequestClose={onCancel} title={title} testID="kiosk-setpin">
      <Animated.View style={{ transform: [{ translateX: shakeX }], gap: theme.spacing(4), alignItems: 'center' }}>
        <Text style={{ ...theme.type.body, color: theme.colors.textMuted, textAlign: 'center' }} testID="kiosk-setpin-sub">
          {sub}
        </Text>
        <PinPad filled={entry.length} onKey={onKey} onDelete={() => setEntry((prev) => deleteDigit(prev))} testIDPrefix="kiosk-setpin" />
        <Button label="Cancel" variant="ghost" onPress={onCancel} testID="kiosk-setpin-cancel" />
      </Animated.View>
    </Modal>
  );
}
