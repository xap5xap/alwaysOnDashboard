// The connect-affordance matrix (AOD-8 §10): the row action is a pure function of (authClass, status),
// never of which service. Exhaustively covering the class x status grid is what proves the seam holds:
// a new integration inherits the right connect UI from its class alone.
import {
  connectLabel,
  connectMechanism,
  rowAction,
  statusLabel,
  type ConnectMechanism,
} from '../affordance';
import type { AuthClass, ConnectionStatus } from '../../registry/types';

describe('connectMechanism maps each auth class to its credential flow (AOD-9 §4)', () => {
  const cases: Array<[AuthClass, ConnectMechanism | null]> = [
    ['oauth2', 'oauth'],
    ['api_key', 'key'],
    ['admin_key', 'key'],
    ['platform_key', 'location'],
    ['none', null],
  ];
  it.each(cases)('%s -> %s', (authClass, mechanism) => {
    expect(connectMechanism(authClass)).toBe(mechanism);
  });
});

describe('connectLabel is the per-mechanism connect-button text', () => {
  it.each([
    ['oauth', 'Connect'],
    ['key', 'Add key'],
    ['location', 'Set location'],
  ] as Array<[ConnectMechanism, string]>)('%s -> %s', (mechanism, label) => {
    expect(connectLabel(mechanism)).toBe(label);
  });
});

describe('rowAction over the full class x status grid', () => {
  it('none (Clock) has no action regardless of status', () => {
    for (const status of [undefined, 'connected', 'error'] as Array<ConnectionStatus | undefined>) {
      expect(rowAction('none', status)).toEqual({ kind: 'none' });
    }
  });

  it('connected -> disconnect for every credentialed class', () => {
    for (const authClass of ['oauth2', 'api_key', 'admin_key', 'platform_key'] as AuthClass[]) {
      expect(rowAction(authClass, 'connected')).toEqual({ kind: 'disconnect', label: 'Disconnect' });
    }
  });

  it('reauth_required and error -> reconnect carrying the class mechanism', () => {
    expect(rowAction('oauth2', 'reauth_required')).toEqual({
      kind: 'reconnect',
      mechanism: 'oauth',
      label: 'Reconnect',
    });
    expect(rowAction('admin_key', 'error')).toEqual({
      kind: 'reconnect',
      mechanism: 'key',
      label: 'Reconnect',
    });
    expect(rowAction('platform_key', 'reauth_required')).toEqual({
      kind: 'reconnect',
      mechanism: 'location',
      label: 'Reconnect',
    });
  });

  it('no row (undefined) and the transient disconnected both -> connect via the class mechanism', () => {
    for (const status of [undefined, 'disconnected'] as Array<ConnectionStatus | undefined>) {
      expect(rowAction('oauth2', status)).toEqual({ kind: 'connect', mechanism: 'oauth', label: 'Connect' });
      expect(rowAction('api_key', status)).toEqual({ kind: 'connect', mechanism: 'key', label: 'Add key' });
      expect(rowAction('platform_key', status)).toEqual({
        kind: 'connect',
        mechanism: 'location',
        label: 'Set location',
      });
    }
  });
});

describe('statusLabel', () => {
  it.each([
    ['connected', 'Connected'],
    ['reauth_required', 'Reconnect needed'],
    ['error', 'Error'],
    ['disconnected', 'Not connected'],
  ] as Array<[ConnectionStatus, string]>)('%s -> %s', (status, label) => {
    expect(statusLabel(status)).toBe(label);
  });

  it('no connection row -> Not connected', () => {
    expect(statusLabel(undefined)).toBe('Not connected');
  });
});
