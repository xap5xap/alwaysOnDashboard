// The connections read layer: Zod validation of the owner-read rows (AOD-9 §5.1) and the row -> map
// reshape. Unknown enum values are handled defensively so a surprising DB value never crashes Settings.
import { rowToConnectionView, toConnectionMap, fetchConnections } from '../connectionsRepo';

jest.mock('../../supabase/client', () => ({
  supabase: { from: jest.fn() },
}));
import { supabase } from '../../supabase/client';

describe('rowToConnectionView', () => {
  it('parses a valid connected platform_key row (Weather/stub shape: no Vault secret, config carries location)', () => {
    const view = rowToConnectionView({
      id: 'c1',
      service: 'stub',
      auth_class: 'platform_key',
      status: 'connected',
      account_label: null,
      config: { city: 'Quito' },
    });
    expect(view).toEqual({
      connectionId: 'c1',
      service: 'stub',
      status: 'connected',
      authClass: 'platform_key',
      accountLabel: null,
      config: { city: 'Quito' },
    });
  });

  it('surfaces an unrecognized status as error (defensive: offers Reconnect, never masks)', () => {
    const view = rowToConnectionView({ id: 'c2', service: 'x', auth_class: 'oauth2', status: 'weird' });
    expect(view?.status).toBe('error');
  });

  it('falls back to none for an unrecognized auth_class', () => {
    const view = rowToConnectionView({ id: 'c3', service: 'x', auth_class: 'totp', status: 'connected' });
    expect(view?.authClass).toBe('none');
  });

  it('keeps a jsonb object config but drops a non-object (array/scalar) config to null', () => {
    expect(rowToConnectionView({ id: 'c4', service: 'x', auth_class: 'oauth2', status: 'connected', config: ['a'] })?.config).toBeNull();
    expect(rowToConnectionView({ id: 'c5', service: 'x', auth_class: 'oauth2', status: 'connected', config: { a: 1 } })?.config).toEqual({ a: 1 });
  });

  it('returns null for a structurally unusable row (missing id)', () => {
    expect(rowToConnectionView({ service: 'x', auth_class: 'oauth2', status: 'connected' })).toBeNull();
  });
});

describe('toConnectionMap', () => {
  it('keys views by service and drops unusable rows', () => {
    const map = toConnectionMap([
      { id: 'a', service: 'stub', auth_class: 'platform_key', status: 'connected' },
      { nope: true },
      { id: 'b', service: 'linear', auth_class: 'oauth2', status: 'reauth_required' },
    ]);
    expect(map.size).toBe(2);
    expect(map.get('stub')?.status).toBe('connected');
    expect(map.get('linear')?.status).toBe('reauth_required');
  });
});

describe('fetchConnections', () => {
  it('selects the owner-read connections columns and returns the map', async () => {
    const select = jest
      .fn()
      .mockResolvedValue({ data: [{ id: 'a', service: 'stub', auth_class: 'platform_key', status: 'connected' }], error: null });
    (supabase.from as jest.Mock).mockReturnValue({ select });

    const map = await fetchConnections();

    expect(supabase.from).toHaveBeenCalledWith('connections');
    expect(select).toHaveBeenCalledWith('id, service, auth_class, status, account_label, config');
    expect(map.get('stub')?.connectionId).toBe('a');
  });

  it('throws when the RLS read errors', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: null, error: { message: 'denied' } }),
    });
    await expect(fetchConnections()).rejects.toEqual({ message: 'denied' });
  });
});
