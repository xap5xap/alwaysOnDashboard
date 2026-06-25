// The live connections query (AOD-25: server state in TanStack Query). Keeps the user's connection
// status map fresh so the Settings surface reflects connect/disconnect immediately. The dashboard host
// does NOT read this map: it reacts to the proxy's 409 (AOD-47), so the host's connected<->disconnected
// flip is driven by query invalidation after a mutation (useConnectionActions), not by this read.
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { fetchConnections, type ConnectionMap } from './connectionsRepo';

export function connectionsQueryKey(userId: string | undefined) {
  return ['connections', userId ?? 'anon'] as const;
}

export interface UseConnectionsResult {
  connections: ConnectionMap;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useConnections(): UseConnectionsResult {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const query = useQuery<ConnectionMap>({
    queryKey: connectionsQueryKey(userId),
    enabled: !!userId,
    queryFn: fetchConnections,
  });

  // Enforce the ConnectionMap contract. The cold-start persister (AOD-25) JSON-serializes the query
  // cache, and a Map round-trips through JSON as a plain `{}` (its entries are lost), so a rehydrated
  // value is not a Map. Coerce anything non-Map back to an empty Map; the query is stale on mount and
  // refetches the live rows immediately. This keeps every consumer (.get here, the connectedServiceIds
  // iteration in the add-widget picker) safe regardless of how the cache was hydrated.
  const connections = query.data instanceof Map ? query.data : new Map();

  return {
    connections,
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null,
  };
}
