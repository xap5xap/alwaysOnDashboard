// The connection mutation path (AOD-9 §6): the client NEVER writes the connections table; every
// credential mutation goes through an AOD-44 Edge Function via supabase.functions.invoke, which
// attaches the session JWT so the broker derives user_id from it. Mirrors ProxyDataSource's typed
// error mapping: a non-2xx from the broker (over_limit 403, invalid_request 400, ...) is surfaced as a
// BrokerError carrying the broker's `{ error, message }` body so the row can show why a connect failed.
import * as Linking from 'expo-linking';
import { supabase } from '../supabase/client';

export interface BrokerError {
  status: number;
  code: string;
  message: string;
}

async function invokeBroker<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw await toBrokerError(error);
  return data as T;
}

/** Map a supabase-js FunctionsHttpError to a BrokerError via its Response context (AOD-9 §6 error shape). */
async function toBrokerError(error: unknown): Promise<BrokerError> {
  const ctx = (error as { context?: Response }).context;
  const status = ctx && typeof ctx.status === 'number' ? ctx.status : 0;
  let code = 'invoke_failed';
  let message = (error as { message?: string })?.message ?? 'Request failed';
  if (ctx) {
    try {
      const body = await ctx.clone().json();
      if (body && typeof body.error === 'string') code = body.error;
      if (body && typeof body.message === 'string') message = body.message;
    } catch {
      // non-JSON body: keep the supabase-js message
    }
  }
  return { status, code, message };
}

/** oauth2 connect step 1 (AOD-9 §7.1): get the provider authorize URL to open in a browser session. */
export async function startOAuth(service: string): Promise<{ authorizeUrl: string }> {
  return invokeBroker('oauth-start', { service });
}

/**
 * Non-OAuth connect (AOD-9 §7.2): for api_key/admin_key pass `apiKey` (stored in Vault); for
 * platform_key pass `location` (stored as the connection config, no Vault secret). Exactly one applies
 * per class; the broker enforces the class.
 */
export async function storeCredentials(input: {
  service: string;
  apiKey?: string;
  location?: Record<string, unknown>;
  accountLabel?: string;
}): Promise<{ ok: true }> {
  return invokeBroker('credentials-store', input);
}

/** Disconnect (AOD-9 §10): purge the credential and eager-delete that service's widget_instances. */
export async function disconnectConnection(connectionId: string): Promise<{ ok: true }> {
  return invokeBroker('disconnect', { connectionId });
}

/**
 * Open the provider authorize URL. The full native deep-link round-trip back into the app is device
 * work (AOD-48 + PS-M3); here we open the URL and the caller re-reads connections on return. Injectable
 * boundary so tests never open a real browser.
 */
export async function openExternalUrl(url: string): Promise<void> {
  await Linking.openURL(url);
}
