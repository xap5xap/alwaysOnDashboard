// The production WidgetDataSource: the AOD-44 proxy. The client names a service + widget, never a URL
// or token (AOD-8 §5.2, AOD-9 §6). supabase-js functions.invoke attaches the session JWT, so the
// signed-in user's session drives the call. Typed proxy failures (409/429/5xx) are mapped to the
// AOD-10 §6.4 ProxyError the host lifecycle reacts to.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProxyError, ProxyResult } from '../widgets/lifecycle';
import type { WidgetDataRequest, WidgetDataSource } from './WidgetDataSource';

export class ProxyDataSource implements WidgetDataSource {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly now: () => number = Date.now,
  ) {}

  async fetch(req: WidgetDataRequest): Promise<ProxyResult> {
    const { data, error } = await this.supabase.functions.invoke('proxy', {
      body: { service: req.serviceId, widget: req.widgetType, params: req.params },
    });
    if (error) throw await toProxyError(error);
    // The proxy returns { data: <payload>, cached, stale? } (proxy/handler.ts). Unwrap the payload.
    const payload =
      data && typeof data === 'object' && 'data' in (data as object)
        ? (data as { data: unknown }).data
        : data;
    return { data: payload, fetchedAt: this.now() };
  }
}

/** Map a supabase-js FunctionsHttpError to the AOD-10 §6.4 typed ProxyError via the response status. */
async function toProxyError(error: unknown): Promise<ProxyError> {
  const ctx = (error as { context?: Response }).context;
  const status = ctx && typeof ctx.status === 'number' ? ctx.status : 0;

  if (status === 409) return { kind: 'needs_reconnect' }; // proxy: no/blocked connection (AOD-9 §9)
  if (status === 429) {
    let retryAfterSeconds: number | undefined;
    try {
      const body = await ctx!.clone().json();
      if (body && typeof body.retryAfterSeconds === 'number') retryAfterSeconds = body.retryAfterSeconds;
    } catch {
      // no parseable body; leave retryAfterSeconds undefined and let backoff use the curve.
    }
    return { kind: 'rate_limited', retryAfterSeconds };
  }
  return { kind: 'provider_unavailable' }; // 5xx / timeout / unknown
}
