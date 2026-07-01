// The exit affordance (design-kiosk-wall.md §7). Presented so a wall is never dismissed by a stray tap yet
// the owner can always leave: an INVISIBLE long-press corner (nothing at rest, a wall advertises no exit),
// which on touch-down reveals a "Hold to exit" hint + an accent progress ring that fills over holdMs, and
// on completion raises a scrim + PIN pad (composing the AOD-67 §9 Modal vocab, the same floating-surface
// the design points at). A wrong PIN shakes and the wall STAYS active; a correct PIN exits. The state
// machine is useExitFlow; the ring/shake motion + the surfaces are here. Colours are read direct off the
// theme (useUnistyles + inline styles) so the sizes come from the `wall` token (theme.wall.exitCorner /
// pinKey) without tripping the computed-role-in-StyleSheet.create pitfall ([[aod-unistyles-style-token-gotcha]]).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import Svg, { Circle } from 'react-native-svg';
import { Button, Modal } from '../ui';
import { PIN_LENGTH } from './pin';
import { HOLD_MS, useExitFlow } from './exitFlow';

const RING_STROKE = 4;

export interface ExitAffordanceProps {
  /** The stored PIN hash to verify against (kioskRuntime.readPinHash()). */
  storedHash: string;
  /** Correct-PIN exit: the wall reverses enter + replaces back to the Dashboard. */
  onExit(): void;
  /** Override the hold duration (defaults to HOLD_MS); primarily for tests. */
  holdMs?: number;
}

/** The accent progress ring that fills over holdMs while the corner is held (§7). Mounted only while
 *  holding, so its mount effect drives the fill and unmount cancels it. Driven by requestAnimationFrame +
 *  state on a PLAIN svg Circle (not an Animated-wrapped one): Animated injects the RN-only `collapsable`
 *  prop, which react-native-svg forwards to the DOM <circle> and React warns on. */
function HoldRing({ size, holdMs }: { size: number; holdMs: number }) {
  const { theme } = useUnistyles();
  const [progress, setProgress] = useState(0);
  const r = (size - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return; // jest / no-rAF: render the ring statically
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / holdMs);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [holdMs]);

  const dashoffset = circumference * (1 - progress);

  return (
    <View testID="kiosk-hold-ring" style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.colors.border} strokeWidth={RING_STROKE} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.colors.accent}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}

/** One PIN-pad key: a wall.pinKey circle (digit) or the backspace, sized for a wall touch target. */
function KeyButton({
  label,
  onPress,
  size,
  testID,
}: {
  label: string;
  onPress: () => void;
  size: number;
  testID: string;
}) {
  const { theme } = useUnistyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ ...theme.type.title, color: theme.colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function ExitAffordance({ storedHash, onExit, holdMs = HOLD_MS }: ExitAffordanceProps) {
  const { theme } = useUnistyles();
  const flow = useExitFlow({ storedHash, onExit, holdMs });
  const corner = theme.wall.exitCorner;
  const key = theme.wall.pinKey;

  // The wrong-PIN shake: re-run a short translateX wobble whenever wrongNonce increments (§7).
  const shakeX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (flow.wrongNonce === 0) return;
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: 6, duration: 50, useNativeDriver: false }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: false }),
    ]).start();
  }, [flow.wrongNonce, shakeX]);

  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];

  return (
    // box-none so the wall behind stays glanceable/untouched except the corner and the PIN surface.
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
      {/* 1. The invisible long-press corner (trailing-bottom). No visible control at rest (§7). */}
      <Pressable
        onPressIn={flow.beginHold}
        onPressOut={flow.cancelHold}
        accessibilityRole="button"
        accessibilityLabel="Hold to exit kiosk"
        testID="kiosk-exit-corner"
        style={{ position: 'absolute', right: 0, bottom: 0, width: corner, height: corner }}
      />

      {/* 2. The reveal-on-touch hint + progress ring, shown ONLY while holding (§7). */}
      {flow.phase === 'holding' ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', right: theme.spacing(4), bottom: theme.spacing(4), alignItems: 'center', gap: theme.spacing(2) }}
        >
          <View
            testID="kiosk-hold-hint"
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.full,
              paddingHorizontal: theme.spacing(3),
              paddingVertical: theme.spacing(1.5),
            }}
          >
            <Text style={{ ...theme.type.label, color: theme.colors.text }}>Hold to exit</Text>
          </View>
          <HoldRing size={corner} holdMs={holdMs} />
        </View>
      ) : null}

      {/* 3. The scrim + PIN pad (composes the AOD-67 §9 Modal). A correct PIN exits; wrong shakes + stays. */}
      <Modal visible={flow.phase === 'pin'} onRequestClose={flow.dismiss} title="Enter PIN" testID="kiosk-pin">
        <Animated.View style={{ transform: [{ translateX: shakeX }], gap: theme.spacing(4), alignItems: 'center' }}>
          {/* the four dots (filled as digits are entered) */}
          <View testID="kiosk-pin-dots" style={{ flexDirection: 'row', gap: theme.spacing(3), paddingVertical: theme.spacing(2) }}>
            {Array.from({ length: PIN_LENGTH }).map((_, i) => {
              const filled = i < flow.entered.length;
              return (
                <View
                  key={i}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: filled ? theme.colors.accent : 'transparent',
                    borderWidth: filled ? 0 : 1.5,
                    borderColor: theme.colors.border,
                  }}
                />
              );
            })}
          </View>

          {/* the numeric keypad (wall.pinKey keys) */}
          <View style={{ gap: theme.spacing(3) }}>
            {rows.map((row) => (
              <View key={row.join('')} style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
                {row.map((d) => (
                  <KeyButton key={d} label={d} size={key} onPress={() => flow.pressKey(d)} testID={`kiosk-pin-key-${d}`} />
                ))}
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
              <View style={{ width: key, height: key }} />
              <KeyButton label="0" size={key} onPress={() => flow.pressKey('0')} testID="kiosk-pin-key-0" />
              <KeyButton label="⌫" size={key} onPress={flow.pressDelete} testID="kiosk-pin-delete" />
            </View>
          </View>

          <Button label="Cancel" variant="ghost" onPress={flow.dismiss} testID="kiosk-pin-cancel" />
        </Animated.View>
      </Modal>
    </View>
  );
}
