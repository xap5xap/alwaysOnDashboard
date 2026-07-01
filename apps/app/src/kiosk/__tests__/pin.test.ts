// The exit PIN logic (kiosk-mode.md §4.3, design-kiosk-wall.md §7). Pure helpers: hash-based verify (the
// plaintext is never compared directly), append/delete on the pad, and correct/wrong/incomplete evaluation.
import {
  PIN_LENGTH,
  DEV_KIOSK_PIN,
  hashPin,
  verifyPin,
  appendDigit,
  deleteDigit,
  evaluatePin,
} from '../pin';

describe('pin §4.3', () => {
  it('PIN_LENGTH is 4 (four dots on the pad)', () => {
    expect(PIN_LENGTH).toBe(4);
    expect(DEV_KIOSK_PIN).toHaveLength(PIN_LENGTH);
  });

  it('hashPin is deterministic and does not equal the plaintext (never stores plaintext)', () => {
    expect(hashPin('1234')).toBe(hashPin('1234'));
    expect(hashPin('1234')).not.toBe('1234');
    expect(hashPin('1234')).not.toBe(hashPin('1235'));
  });

  it('verifyPin: hash(entered) === storedHash', () => {
    const stored = hashPin('4821');
    expect(verifyPin('4821', stored)).toBe(true);
    expect(verifyPin('4820', stored)).toBe(false);
    expect(verifyPin('', stored)).toBe(false);
  });

  it('appendDigit fills up to PIN_LENGTH and then ignores extra input', () => {
    expect(appendDigit('', '1')).toBe('1');
    expect(appendDigit('12', '3')).toBe('123');
    expect(appendDigit('1234', '5')).toBe('1234'); // never over-fills
  });

  it('deleteDigit removes the last digit (and is a no-op on empty)', () => {
    expect(deleteDigit('123')).toBe('12');
    expect(deleteDigit('')).toBe('');
  });

  it('evaluatePin: incomplete until 4 digits, then correct / wrong against the hash', () => {
    const stored = hashPin('1234');
    expect(evaluatePin('12', stored)).toBe('incomplete');
    expect(evaluatePin('123', stored)).toBe('incomplete');
    expect(evaluatePin('1234', stored)).toBe('correct');
    expect(evaluatePin('9999', stored)).toBe('wrong');
  });
});
