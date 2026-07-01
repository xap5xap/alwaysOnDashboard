// The exit PIN logic (kiosk-mode.md §4.3, design-kiosk-wall.md §7). Pure helpers only: the PIN is verified
// against a HASH (the plaintext is never stored or compared directly), the pad appends/deletes digits, and
// the entry evaluates to correct / wrong / incomplete. The HASH STORAGE is a platform mechanic
// (expo-secure-store on native) and lives behind the runtime seam (kioskRuntime.readPinHash), NOT here;
// this module is the pure, testable core the pad and the exit flow compose.
//
// The hash is a small non-cryptographic digest: a 4-digit PIN is brute-forceable regardless of the digest,
// so the point (per §4.3) is only that the PLAINTEXT is never persisted, not cryptographic strength. The
// native follow-up (the K-M1 runtime seam) may swap this for an expo-crypto SHA-256 held in secure-store;
// the verify contract (hash(entered) === storedHash) is unchanged.

/** The exit PIN length. Four digits, matching the design-kiosk-wall.md §7 pad (four dots). */
export const PIN_LENGTH = 4;

/** The dev/web default PIN. Real PIN setup is the kiosk ENTRY/config surface (out of scope; AOD-21 §9 +
 *  a follow-up). On the web slice the runtime seam returns hashPin(DEV_KIOSK_PIN) so the exit flow is
 *  demonstrable end to end; on native the seam reads the configured hash from expo-secure-store. */
export const DEV_KIOSK_PIN = '1234';

/** A small deterministic digest (djb2 xor variant) rendered as hex. Not cryptographic (see file header). */
export function hashPin(pin: string): string {
  let h = 5381;
  for (let i = 0; i < pin.length; i++) {
    h = ((h << 5) + h) ^ pin.charCodeAt(i); // h * 33 xor c
    h |= 0; // keep it a 32-bit int
  }
  return (h >>> 0).toString(16);
}

/** Verify an entered PIN against a stored hash (§4.3): hash the entry and compare. */
export function verifyPin(entered: string, storedHash: string): boolean {
  return hashPin(entered) === storedHash;
}

/** Append one digit to the entry, ignoring input once the PIN is full (the pad never over-fills). */
export function appendDigit(entered: string, digit: string): string {
  if (entered.length >= PIN_LENGTH) return entered;
  return entered + digit;
}

/** Delete the last digit (the pad's backspace). */
export function deleteDigit(entered: string): string {
  return entered.slice(0, -1);
}

export type PinResult = 'incomplete' | 'correct' | 'wrong';

/** Evaluate an entry against a stored hash: incomplete until PIN_LENGTH digits, then correct / wrong. */
export function evaluatePin(entered: string, storedHash: string): PinResult {
  if (entered.length < PIN_LENGTH) return 'incomplete';
  return verifyPin(entered, storedHash) ? 'correct' : 'wrong';
}
