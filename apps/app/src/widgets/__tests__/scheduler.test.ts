// AOD-10 §6.2/§6.3/§6.4 pure-function units (testing-strategy.md §4.1).
import { effectiveInterval, nextDelaySeconds, requestKey } from '../scheduler';

describe('effectiveInterval (AOD-10 §6.2)', () => {
  it('clamps a desired below the floor up to max(minRefreshSeconds, entitlementFloorSeconds)', () => {
    expect(effectiveInterval({ defaultRefresh: { seconds: 30 }, minRefreshSeconds: 60 }, {}, 0)).toEqual({ seconds: 60 });
    expect(effectiveInterval({ defaultRefresh: { seconds: 30 }, minRefreshSeconds: 60 }, {}, 900)).toEqual({ seconds: 900 });
  });
  it('passes a desired above the floor through', () => {
    expect(effectiveInterval({ defaultRefresh: { seconds: 600 }, minRefreshSeconds: 60 }, {}, 0)).toEqual({ seconds: 600 });
  });
  it('applies only the widget floor when entitlementFloorSeconds=0 (Pro)', () => {
    expect(effectiveInterval({ defaultRefresh: { seconds: 10 }, minRefreshSeconds: 60 }, {}, 0)).toEqual({ seconds: 60 });
  });
  it('honors a per-instance refresh override', () => {
    expect(effectiveInterval({ defaultRefresh: { seconds: 300 } }, { refresh: { seconds: 120 } }, 0)).toEqual({ seconds: 120 });
  });
  it('passes "manual" through unclamped', () => {
    expect(effectiveInterval({ defaultRefresh: 'manual' }, {}, 900)).toBe('manual');
    expect(effectiveInterval({ defaultRefresh: { seconds: 300 } }, { refresh: 'manual' }, 900)).toBe('manual');
  });
});

describe('nextDelaySeconds (AOD-10 §6.4)', () => {
  it('grows exponentially and caps at 1800s', () => {
    expect(nextDelaySeconds(60, 0, { kind: 'service_error' })).toBe(60);
    expect(nextDelaySeconds(60, 2, { kind: 'service_error' })).toBe(240);
    expect(nextDelaySeconds(1000, 5, { kind: 'service_error' })).toBe(1800);
  });
  it('caps the exponent at 6 consecutive failures', () => {
    expect(nextDelaySeconds(10, 6, { kind: 'service_error' })).toBe(640);
    expect(nextDelaySeconds(10, 100, { kind: 'service_error' })).toBe(640);
  });
  it('honors a rate_limited Retry-After exactly', () => {
    expect(nextDelaySeconds(60, 3, { kind: 'rate_limited', retryAfterSeconds: 30 })).toBe(30);
  });
  it('returns "stop" for needs_reconnect', () => {
    expect(nextDelaySeconds(60, 0, { kind: 'needs_reconnect' })).toBe('stop');
  });
});

describe('requestKey (AOD-10 §6.3)', () => {
  it('produces the identical key regardless of param order', () => {
    expect(requestKey('linear', 'my_issues', { a: 1, b: 2 })).toBe(requestKey('linear', 'my_issues', { b: 2, a: 1 }));
  });
  it('produces different keys for different params', () => {
    expect(requestKey('linear', 'my_issues', { a: 1 })).not.toBe(requestKey('linear', 'my_issues', { a: 2 }));
  });
});
