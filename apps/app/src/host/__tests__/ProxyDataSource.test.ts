// AOD-127: the ProxyDataSource failure taxonomy. Proves toProxyError splits the former catch-all into the
// three distinct signals the Holding Course edges need, using the supabase-js error CLASS as the seam:
//   FunctionsHttpError  -> `context` is the HTTP Response (numeric .status): Vela answered
//                          409 -> needs_reconnect · 429 -> rate_limited · else (5xx/other) -> service_error
//   FunctionsFetchError -> no Response reached us: netinfo at the moment of failure decides
//                          offline -> device_offline · online -> vela_unreachable
// The online state is injected (never native in the mapper), so these are pure and deterministic.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { onlineManager } from '@tanstack/react-query';
import { ProxyDataSource } from '../ProxyDataSource';
import type { WidgetDataRequest } from '../WidgetDataSource';
import type { ProxyError } from '../../widgets/lifecycle';

const REQ: WidgetDataRequest = { serviceId: 'linear', widgetType: 'my_issues', params: { project: 'X' } };

/** A minimal object carrying what toProxyError reads off a FunctionsHttpError's Response context. */
function fakeResponse(status: number, body?: unknown): Response {
  return { status, clone: () => ({ json: async () => body }) } as unknown as Response;
}

/** Build a ProxyDataSource over a fake supabase whose functions.invoke resolves to one { data, error }. */
function makeSource(
  invokeResult: { data: unknown; error: unknown },
  opts: { isOnline?: () => boolean } = {},
) {
  const invoke = jest.fn().mockResolvedValue(invokeResult);
  const supabase = { functions: { invoke } } as unknown as SupabaseClient;
  const source =
    opts.isOnline === undefined
      ? new ProxyDataSource(supabase, () => 1000)
      : new ProxyDataSource(supabase, () => 1000, opts.isOnline);
  return { source, invoke };
}

/** Run fetch() and capture the thrown ProxyError. */
async function fetchError(
  invokeResult: { data: unknown; error: unknown },
  opts: { isOnline?: () => boolean } = {},
): Promise<ProxyError> {
  const { source } = makeSource(invokeResult, opts);
  try {
    await source.fetch(REQ);
    throw new Error('expected fetch to throw');
  } catch (e) {
    return e as ProxyError;
  }
}

afterEach(() => {
  onlineManager.setOnline(true); // reset the global for the default-isOnline cases
});

describe('ProxyDataSource.fetch success (AOD-44 payload unwrap)', () => {
  it('unwraps { data: payload } and stamps the injected now', async () => {
    const { source } = makeSource({ data: { data: { count: 6 }, cached: false }, error: null });
    await expect(source.fetch(REQ)).resolves.toEqual({ data: { count: 6 }, fetchedAt: 1000 });
  });

  it('passes a bare payload through when there is no { data } envelope', async () => {
    const { source } = makeSource({ data: { count: 6 }, error: null });
    await expect(source.fetch(REQ)).resolves.toEqual({ data: { count: 6 }, fetchedAt: 1000 });
  });
});

describe('toProxyError — Vela answered (FunctionsHttpError)', () => {
  it('409 -> needs_reconnect', async () => {
    expect(await fetchError({ data: null, error: { context: fakeResponse(409) } })).toEqual({
      kind: 'needs_reconnect',
    });
  });

  it('429 with a retryAfterSeconds body -> rate_limited carrying it', async () => {
    const err = await fetchError({
      data: null,
      error: { context: fakeResponse(429, { retryAfterSeconds: 30 }) },
    });
    expect(err).toEqual({ kind: 'rate_limited', retryAfterSeconds: 30 });
  });

  it('429 with no parseable body -> rate_limited, retryAfterSeconds undefined', async () => {
    const err = await fetchError({
      data: null,
      error: { context: { status: 429, clone: () => ({ json: async () => { throw new Error('no body'); } }) } },
    });
    expect(err).toEqual({ kind: 'rate_limited', retryAfterSeconds: undefined });
  });

  it('500 -> service_error (our backend is up; one upstream service failed)', async () => {
    expect(await fetchError({ data: null, error: { context: fakeResponse(500) } })).toEqual({
      kind: 'service_error',
    });
  });

  it('503 -> service_error', async () => {
    expect(await fetchError({ data: null, error: { context: fakeResponse(503) } })).toEqual({
      kind: 'service_error',
    });
  });

  it('a non-2xx that is not 409/429 (e.g. 400) -> service_error', async () => {
    expect(await fetchError({ data: null, error: { context: fakeResponse(400) } })).toEqual({
      kind: 'service_error',
    });
  });
});

describe('toProxyError — Vela never answered (FunctionsFetchError), split by netinfo', () => {
  const noResponseError = { context: { requestId: 'abc' } }; // FunctionsFetchError-shaped: no numeric status

  it('device offline at the moment of failure -> device_offline (YOUR network)', async () => {
    expect(await fetchError({ data: null, error: noResponseError }, { isOnline: () => false })).toEqual({
      kind: 'device_offline',
    });
  });

  it('device online but the request never got an answer -> vela_unreachable (OUR server)', async () => {
    expect(await fetchError({ data: null, error: noResponseError }, { isOnline: () => true })).toEqual({
      kind: 'vela_unreachable',
    });
  });

  it('a wholly context-less error also splits on netinfo (timeout / unknown)', async () => {
    expect(await fetchError({ data: null, error: {} }, { isOnline: () => false })).toEqual({
      kind: 'device_offline',
    });
    expect(await fetchError({ data: null, error: {} }, { isOnline: () => true })).toEqual({
      kind: 'vela_unreachable',
    });
  });

  it('defaults isOnline to the global onlineManager when none is injected', async () => {
    onlineManager.setOnline(false);
    expect(await fetchError({ data: null, error: noResponseError })).toEqual({ kind: 'device_offline' });
    onlineManager.setOnline(true);
    expect(await fetchError({ data: null, error: noResponseError })).toEqual({ kind: 'vela_unreachable' });
  });
});

describe('toProxyError — the supabase-js class discriminator (empirical)', () => {
  it('a real FunctionsHttpError carries a numeric-status Response context (-> service_error branch)', async () => {
    const httpErr = new FunctionsHttpError(fakeResponse(500));
    expect(typeof (httpErr.context as Response).status).toBe('number');
    expect(await fetchError({ data: null, error: httpErr })).toEqual({ kind: 'service_error' });
  });

  it('a real FunctionsFetchError has no numeric-status context (-> offline/unreachable branch)', async () => {
    const fetchErr = new FunctionsFetchError({ requestId: 'abc' });
    expect(typeof (fetchErr.context as { status?: unknown }).status).not.toBe('number');
    expect(await fetchError({ data: null, error: fetchErr }, { isOnline: () => true })).toEqual({
      kind: 'vela_unreachable',
    });
  });

  it('a real FunctionsRelayError -> vela_unreachable, matched by NAME even though it carries a status Response', async () => {
    // The relay (Vela's serving layer) failed to reach the function; supabase-js passes the Response, so
    // isHttpResponse would misread it as a per-card service_error without the name branch (AOD-127 review fix).
    const relayErr = new FunctionsRelayError(fakeResponse(502));
    expect(relayErr.name).toBe('FunctionsRelayError');
    expect(typeof (relayErr.context as Response).status).toBe('number'); // it DOES carry a status
    // Online or offline, a relay fault is Vela's side -> vela_unreachable, never device_offline/service_error.
    expect(await fetchError({ data: null, error: relayErr }, { isOnline: () => true })).toEqual({
      kind: 'vela_unreachable',
    });
    expect(await fetchError({ data: null, error: relayErr }, { isOnline: () => false })).toEqual({
      kind: 'vela_unreachable',
    });
  });
});

describe('ProxyDataSource.resolveOptions maps errors through the same taxonomy', () => {
  it('returns the choices array on success', async () => {
    const { source } = makeSource({ data: { choices: [{ value: 'a', label: 'A' }] }, error: null });
    await expect(source.resolveOptions({ serviceId: 'linear', optionSource: 'projects', params: {} })).resolves.toEqual([
      { value: 'a', label: 'A' },
    ]);
  });

  it('a network-level failure while offline -> device_offline', async () => {
    const { source } = makeSource(
      { data: null, error: { context: { requestId: 'abc' } } },
      { isOnline: () => false },
    );
    await expect(source.resolveOptions({ serviceId: 'linear', optionSource: 'projects', params: {} })).rejects.toEqual({
      kind: 'device_offline',
    });
  });
});
