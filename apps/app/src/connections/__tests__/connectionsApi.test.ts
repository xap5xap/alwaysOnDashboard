// The mutation path: every credential write goes through an AOD-44 Edge Function via
// functions.invoke (never a direct connections write), and a broker non-2xx is mapped to a BrokerError
// carrying the broker's { error, message } body so the row can show why a connect failed.
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('../../supabase/client', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

import { supabase } from '../../supabase/client';
import { startOAuth, storeCredentials, disconnectConnection } from '../connectionsApi';

const invoke = supabase.functions.invoke as jest.Mock;

/** A fake supabase-js FunctionsHttpError whose .context behaves like the broker Response. */
function httpError(status: number, body: unknown) {
  return {
    message: 'Edge Function returned a non-2xx status code',
    context: {
      status,
      clone: () => ({ json: async () => body }),
    },
  };
}

beforeEach(() => invoke.mockReset());

describe('the invokers call the right Edge Function with the session-JWT-carrying invoke', () => {
  it('startOAuth -> oauth-start { service }', async () => {
    invoke.mockResolvedValue({ data: { authorizeUrl: 'https://linear.app/oauth/authorize?x=1' }, error: null });
    const out = await startOAuth('linear');
    expect(invoke).toHaveBeenCalledWith('oauth-start', { body: { service: 'linear' } });
    expect(out.authorizeUrl).toContain('linear.app');
  });

  it('storeCredentials (platform_key) -> credentials-store { service, location }', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await storeCredentials({ service: 'stub', location: { city: 'Quito' } });
    expect(invoke).toHaveBeenCalledWith('credentials-store', { body: { service: 'stub', location: { city: 'Quito' } } });
  });

  it('storeCredentials (api_key) -> credentials-store { service, apiKey }', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await storeCredentials({ service: 'anthropic_usage', apiKey: 'sk-ant-admin-xxx' });
    expect(invoke).toHaveBeenCalledWith('credentials-store', { body: { service: 'anthropic_usage', apiKey: 'sk-ant-admin-xxx' } });
  });

  it('disconnectConnection -> disconnect { connectionId }', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await disconnectConnection('conn-123');
    expect(invoke).toHaveBeenCalledWith('disconnect', { body: { connectionId: 'conn-123' } });
  });
});

describe('broker error mapping', () => {
  it('maps a 403 over_limit body to a BrokerError with the broker code + message', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(403, { error: 'over_limit', message: 'Free is limited to 2 connected services' }),
    });
    await expect(storeCredentials({ service: 'stub', location: { city: 'Quito' } })).rejects.toEqual({
      status: 403,
      code: 'over_limit',
      message: 'Free is limited to 2 connected services',
    });
  });

  it('falls back to the supabase-js message when the body is not JSON', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { status: 500, clone: () => ({ json: async () => { throw new Error('not json'); } }) },
      },
    });
    await expect(disconnectConnection('c1')).rejects.toMatchObject({
      status: 500,
      code: 'invoke_failed',
      message: 'Edge Function returned a non-2xx status code',
    });
  });
});
