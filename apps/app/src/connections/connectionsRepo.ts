// The connections read layer (AOD-9 §5.1, data-model §8.2 `connections_select_own`): the client reads
// its OWN connection rows under owner-read RLS and NEVER writes them (every mutation goes through the
// AOD-44 Edge Functions, connectionsApi.ts). supabase-js carries the session JWT, so the select is
// scoped to auth.uid() automatically. Zod validates the status/auth_class enums and the config jsonb
// (AOD-25: the one shared validation layer); a row whose status is unrecognized is treated defensively
// as `error` rather than crashing the Settings list. This module reshapes data only; it names no service.
import { z } from 'zod';
import { supabase } from '../supabase/client';
import type { AuthClass, ConnectionStatus, ServiceId } from '../registry/types';

// The AOD-9 §5.1 status enum and the AOD-8 §5 auth-class taxonomy, mirrored as Zod guards.
const ConnectionStatusSchema = z.enum(['connected', 'reauth_required', 'error', 'disconnected']);
const AuthClassSchema = z.enum(['oauth2', 'api_key', 'admin_key', 'platform_key', 'none']);

// Structural shape of a connections row as the client sees it (owner-read columns only; the Vault
// secret-id refs are never selected because they are useless to the client, AOD-9 §5.1).
const ConnectionRowSchema = z.object({
  id: z.string(),
  service: z.string(),
  auth_class: z.string(),
  status: z.string(),
  account_label: z.string().nullable().optional(),
  config: z.unknown().optional(),
});

export interface ConnectionView {
  connectionId: string; // the row id; the disconnect Edge Function targets by this (AOD-9 §10)
  service: ServiceId;
  status: ConnectionStatus;
  authClass: AuthClass;
  accountLabel: string | null;
  config: Record<string, unknown> | null;
}

/** service id -> the user's connection for it. Absent key = no connection row = "Not connected". */
export type ConnectionMap = Map<ServiceId, ConnectionView>;

function asConfigObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** DB row -> ConnectionView, or null if the row is structurally unusable (dropped, never crashes). */
export function rowToConnectionView(row: unknown): ConnectionView | null {
  const parsed = ConnectionRowSchema.safeParse(row);
  if (!parsed.success) return null;
  const r = parsed.data;

  const status = ConnectionStatusSchema.safeParse(r.status);
  const authClass = AuthClassSchema.safeParse(r.auth_class);

  return {
    connectionId: r.id,
    service: r.service,
    // An unrecognized status is surfaced as `error` so the row offers a Reconnect rather than masking it.
    status: status.success ? status.data : 'error',
    authClass: authClass.success ? authClass.data : 'none',
    accountLabel: r.account_label ?? null,
    config: asConfigObject(r.config),
  };
}

export function toConnectionMap(rows: readonly unknown[]): ConnectionMap {
  const map: ConnectionMap = new Map();
  for (const row of rows) {
    const view = rowToConnectionView(row);
    if (view) map.set(view.service, view);
  }
  return map;
}

/** The service ids the user has a live `connected` connection for. The add-widget picker feeds this to
 *  registry.addableWidgets (AOD-8 §9 invariant 2): `reauth_required`/`error` are NOT connected, so their
 *  widgets are not offered until the connection is healthy again. Clock (authClass 'none') is exempt
 *  inside addableWidgets, not here, so this stays a plain status filter that names no service. */
export function connectedServiceIds(map: ConnectionMap): Set<ServiceId> {
  const ids = new Set<ServiceId>();
  for (const [service, view] of map) {
    if (view.status === 'connected') ids.add(service);
  }
  return ids;
}

/** Read the signed-in user's connections under RLS. The query is owner-scoped by the session JWT. */
export async function fetchConnections(): Promise<ConnectionMap> {
  const { data, error } = await supabase
    .from('connections')
    .select('id, service, auth_class, status, account_label, config');
  if (error) throw error;
  return toConnectionMap(data ?? []);
}
