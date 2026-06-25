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

  return {
    connections: query.data ?? new Map(),
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error | null) ?? null,
  };
}
