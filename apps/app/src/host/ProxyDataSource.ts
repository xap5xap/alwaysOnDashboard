// The production WidgetDataSource: the AOD-44 proxy. The client names a service + widget, never a URL
// or token (AOD-8 §5.2, AOD-9 §6). supabase-js functions.invoke attaches the session JWT, so the
// signed-in user's session drives the call. Typed proxy failures are mapped to the AOD-10 §6.4 ProxyError
// the host lifecycle reacts to.
//
// AOD-127: the failure map splits by supabase-js error CLASS, not just status. functions.invoke throws:
//   - FunctionsHttpError  — Vela was reached and answered a non-2xx (`context` is the HTTP Response) ->
//     one upstream service failed (service_error), or 409/429.
//   - FunctionsRelayError — Vela's edge relay could not reach the function -> OUR serving layer is down
//     (vela_unreachable). It carries a Response too, so it is matched by NAME before the status branch.
//   - FunctionsFetchError — the request never got an answer at all (network-level) -> device_offline vs
//     vela_unreachable, disambiguated by netinfo at the moment of failure.
// This is a CLIENT-ONLY inference — no proxy/server change is required to tell self-vs-upstream apart.
import type { SupabaseClient } from '@supabase/supabase-js';
import { onlineManager } from '@tanstack/react-query';
import type { Choice } from '../registry/types';
import type { ProxyError, ProxyResult } from '../widgets/lifecycle';
import type { OptionSourceRequest, WidgetDataRequest, WidgetDataSource } from './WidgetDataSource';

export class ProxyDataSource implements WidgetDataSource {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly now: () => number = Date.now,
    // Injected so toProxyError stays pure-ish and testable — the mapper never touches native. Defaults to
    // the global onlineManager (fed by netinfo via setupOnlineManager), read at the moment of failure.
    private readonly isOnline: () => boolean = () => onlineManager.isOnline(),
  ) {}

  async fetch(req: WidgetDataRequest): Promise<ProxyResult> {
    const { data, error } = await this.supabase.functions.invoke('proxy', {
      body: { service: req.serviceId, widget: req.widgetType, params: req.params },
    });
    if (error) throw await toProxyError(error, this.isOnline);
    // The proxy returns { data: <payload>, cached, stale? } (proxy/handler.ts). Unwrap the payload.
    const payload =
      data && typeof data === 'object' && 'data' in (data as object)
        ? (data as { data: unknown }).data
        : data;
    return { data: payload, fetchedAt: this.now() };
  }

  async resolveOptions(req: OptionSourceRequest): Promise<Choice[]> {
    const { data, error } = await this.supabase.functions.invoke('config-options', {
      body: { service: req.serviceId, optionSource: req.optionSource, params: req.params },
    });
    if (error) throw await toProxyError(error, this.isOnline); // same map: 409/429/5xx + offline/unreachable
    // config-options returns { choices: Choice[], cached? } (config-options/handler.ts).
    const choices =
      data && typeof data === 'object' && 'choices' in (data as object)
        ? (data as { choices: unknown }).choices
        : data;
    return Array.isArray(choices) ? (choices as Choice[]) : [];
  }
}

/** A supabase-js FunctionsHttpError carries the HTTP Response on `context` (it has a numeric `status`); a
 *  FunctionsFetchError does not. That presence is the "Vela answered vs never reached Vela" discriminator.
 *  (FunctionsRelayError also carries a Response but is matched by name earlier — it is a Vela-side fault.) */
function isHttpResponse(ctx: unknown): ctx is Response {
  return typeof ctx === 'object' && ctx !== null && typeof (ctx as { status?: unknown }).status === 'number';
}

/**
 * Map a supabase-js functions.invoke error to the AOD-10 §6.4 / AOD-127 typed ProxyError.
 *
 * If the error carries an HTTP Response (FunctionsHttpError), Vela was reached and answered:
 *   409 -> needs_reconnect (no/blocked connection, AOD-9 §9), 429 -> rate_limited (honor Retry-After),
 *   anything else (5xx, or a 4xx that isn't 409/429) -> service_error: our backend is up, so this is one
 *   upstream service's own trouble ("theirs" — the card-level error badge).
 *
 * A FunctionsRelayError (Vela's relay could not reach the function) is caught first by name -> vela_unreachable.
 *
 * If there is NO Response (FunctionsFetchError / timeout), the request never got an answer — a network-level
 * failure talking to Vela. netinfo at the moment of failure decides whose network is at fault: offline ->
 * device_offline (YOUR network, amber), online -> vela_unreachable (OUR server, red).
 */
async function toProxyError(error: unknown, isOnline: () => boolean): Promise<ProxyError> {
  // A FunctionsRelayError is Supabase's edge RELAY failing to reach the function. It carries an HTTP
  // Response (so it would fall through to the isHttpResponse status branch below and read as a per-card
  // service_error) — but the fault is Vela's own serving layer, not an upstream service, so it must be
  // caught FIRST and mapped to vela_unreachable (OUR server, sky-wide). (AOD-127 review fix.)
  if ((error as { name?: unknown }).name === 'FunctionsRelayError') return { kind: 'vela_unreachable' };

  const ctx = (error as { context?: unknown }).context;

  if (isHttpResponse(ctx)) {
    if (ctx.status === 409) return { kind: 'needs_reconnect' };
    if (ctx.status === 429) {
      let retryAfterSeconds: number | undefined;
      try {
        const body = await ctx.clone().json();
        if (body && typeof body.retryAfterSeconds === 'number') retryAfterSeconds = body.retryAfterSeconds;
      } catch {
        // no parseable body; leave retryAfterSeconds undefined and let backoff use the curve.
      }
      return { kind: 'rate_limited', retryAfterSeconds };
    }
    return { kind: 'service_error' }; // Vela answered non-2xx: an upstream service failed
  }

  // No HTTP Response reached us: the fetch to Vela itself failed at the network level.
  return isOnline() ? { kind: 'vela_unreachable' } : { kind: 'device_offline' };
}
