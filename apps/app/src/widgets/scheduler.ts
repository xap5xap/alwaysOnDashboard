// Device-side refresh scheduler math (AOD-10 §6.2, §6.3, §6.4). Pure and I/O-free; these configure
// TanStack Query in the host (AOD-25): effectiveInterval -> refetchInterval, nextDelaySeconds ->
// retryDelay, requestKey -> queryKey. The provider-facing cache TTL and the per-user fetch-floor are
// server-side (AOD-9 proxy / AOD-12 §6.4) and back this up; the device math only sets cadence.
import type { RefreshInterval, ServiceId, WidgetTypeId } from '../registry/types';
import type { ProxyError } from './lifecycle';

/**
 * The interval a device schedules: the widget default (or per-instance override) clamped from below
 * by max(minRefreshSeconds, entitlementFloorSeconds) (AOD-10 §6.2). "manual" passes through
 * unclamped. AOD-12 supplies entitlementFloorSeconds (0 when no tier limit applies); AOD-10 never
 * reads a tier.
 */
export function effectiveInterval(
  def: { defaultRefresh: RefreshInterval; minRefreshSeconds?: number },
  instance: { refresh?: RefreshInterval },
  entitlementFloorSeconds: number,
): RefreshInterval {
  const desired = instance.refresh ?? def.defaultRefresh;
  if (desired === 'manual') return 'manual';
  const floor = Math.max(def.minRefreshSeconds ?? 0, entitlementFloorSeconds);
  return { seconds: Math.max(desired.seconds, floor) };
}

/**
 * Backoff after a typed provider error (AOD-10 §6.4). needs_reconnect stops polling (go to the
 * disconnected state). rate_limited with a Retry-After honors it exactly. Otherwise exponential
 * growth with the exponent capped at 6 consecutive failures and the delay capped at 1800s; the
 * scheduler adds jitter on top.
 */
export function nextDelaySeconds(
  baseSeconds: number,
  consecutiveFailures: number,
  err: ProxyError,
): number | 'stop' {
  if (err.kind === 'needs_reconnect') return 'stop';
  if (err.kind === 'rate_limited' && err.retryAfterSeconds != null) return err.retryAfterSeconds;
  const exp = baseSeconds * 2 ** Math.min(consecutiveFailures, 6);
  return Math.min(exp, 1800);
}

export type RequestKey = string;

/**
 * The canonical single-flight / cache key (AOD-10 §6.3). Params are serialized with sorted keys so
 * {a,b} and {b,a} hash equal, and the device and the proxy agree on the key. Same key across devices
 * is what lets the proxy cache coalesce one provider call across a phone and a kiosk tablet.
 */
export function requestKey(
  serviceId: ServiceId,
  widgetType: WidgetTypeId,
  params: Record<string, unknown>,
): RequestKey {
  const canonical = JSON.stringify(params, Object.keys(params).sort());
  return `${serviceId}:${widgetType}:${canonical}`;
}
