// The connect-affordance core (AOD-8 §5.1, §10): the ONE place that maps a service's auth class plus
// its live connection status to the row's action. It branches on the AuthClass and the
// ConnectionStatus, NEVER on which service, so a new integration inherits the right connect UI by
// registration alone. The Settings list (ConnectionsList) and rows consume this; the engine stays
// generic. Pure and I/O-free, so the whole class x status matrix is unit-tested deterministically.
import type { AuthClass, ConnectionStatus } from '../registry/types';

/** Which credential flow a class connects through (AOD-9 §4 / §7). `none` (Clock) connects through nothing. */
export type ConnectMechanism = 'oauth' | 'key' | 'location';

export function connectMechanism(authClass: AuthClass): ConnectMechanism | null {
  switch (authClass) {
    case 'oauth2':
      return 'oauth'; // oauth-start -> open the provider authorize URL (AOD-9 §7.1)
    case 'api_key':
    case 'admin_key':
      return 'key'; // a user-supplied key -> credentials-store -> Vault (AOD-9 §7.2)
    case 'platform_key':
      return 'location'; // a user-supplied location -> credentials-store -> connection config, no Vault (AOD-9 §7.2)
    case 'none':
      return null; // Clock: no connection (AOD-8 §9 invariant 2 exemption)
  }
}

/** The connect-button label per mechanism. Generic over the class, never the service. */
export function connectLabel(mechanism: ConnectMechanism): string {
  switch (mechanism) {
    case 'oauth':
      return 'Connect';
    case 'key':
      return 'Add key';
    case 'location':
      return 'Set location';
  }
}

/**
 * The row's action, derived from (authClass, status). `connected` -> disconnect; `reauth_required` /
 * `error` -> reconnect (re-run the class's connect mechanism, AOD-9 §9 reconnect path); anything else
 * (no row, or the transient `disconnected`) -> connect via the class mechanism. `none` -> no action.
 */
export type RowAction =
  | { kind: 'connect'; mechanism: ConnectMechanism; label: string }
  | { kind: 'reconnect'; mechanism: ConnectMechanism; label: string }
  | { kind: 'disconnect'; label: string }
  | { kind: 'none' };

export function rowAction(authClass: AuthClass, status: ConnectionStatus | undefined): RowAction {
  const mechanism = connectMechanism(authClass);
  if (mechanism === null) return { kind: 'none' };
  if (status === 'connected') return { kind: 'disconnect', label: 'Disconnect' };
  if (status === 'reauth_required' || status === 'error') {
    return { kind: 'reconnect', mechanism, label: 'Reconnect' };
  }
  // undefined (no connection row) or the transient `disconnected` value (data-model §11): connect.
  return { kind: 'connect', mechanism, label: connectLabel(mechanism) };
}

/** Human-readable status for the row, including the no-row ("Not connected") case. */
export function statusLabel(status: ConnectionStatus | undefined): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'reauth_required':
      return 'Reconnect needed';
    case 'error':
      return 'Error';
    case 'disconnected':
    case undefined:
    default:
      return 'Not connected';
  }
}
