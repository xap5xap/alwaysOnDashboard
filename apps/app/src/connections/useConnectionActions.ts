// The connection mutations + the cache invalidation that keeps everything live. Each action invokes an
// AOD-44 Edge Function (connectionsApi) and then invalidates the three things a credential change can
// move: the connections list (this surface), the dashboard membership (AOD-49: disconnect deletes the
// service's widget_instances), and the widget host proxy results (AOD-47: connecting flips a widget out
// of the disconnected 409 state, disconnecting drops it). This is the seam that makes "the host reacts"
// true without touching the host or the layout engine.
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { dashboardQueryPrefix } from '../layout/useDashboard';
import {
  disconnectConnection,
  openExternalUrl,
  startOAuth,
  storeCredentials,
} from './connectionsApi';
import { connectionsQueryKey } from './useConnections';

export interface ConnectionActions {
  /** oauth2: get the authorize URL and open it; the round-trip back is device work (AOD-48 + PS-M3). */
  oauthConnect(serviceId: string): Promise<void>;
  /** api_key/admin_key -> { apiKey }; platform_key -> { location }. The broker enforces the class. */
  submitCredentials(
    serviceId: string,
    payload: { apiKey?: string; location?: Record<string, unknown> },
  ): Promise<void>;
  disconnect(connectionId: string): Promise<void>;
}

export function useConnectionActions(): ConnectionActions {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: connectionsQueryKey(userId) });
    // AOD-197 (Pass B2): dashboard membership is orientation-INDEPENDENT (a disconnect deletes the service's
    // instances regardless of orientation), so reconcile BOTH orientations via the prefix.
    queryClient.invalidateQueries({ queryKey: dashboardQueryPrefix(userId) });
    // Widget host queries are keyed by requestKey ("serviceId:widgetType:params", scheduler.ts), so a
    // string key containing ":" is a widget query. Invalidating them re-runs the proxy, which is what
    // flips a widget out of the disconnected state on connect (no longer 409) and clears it on disconnect.
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.includes(':');
      },
    });
  }, [queryClient, userId]);

  const oauthConnect = useCallback(
    async (serviceId: string) => {
      const { authorizeUrl } = await startOAuth(serviceId);
      await openExternalUrl(authorizeUrl);
      invalidate();
    },
    [invalidate],
  );

  const submitCredentials = useCallback(
    async (serviceId: string, payload: { apiKey?: string; location?: Record<string, unknown> }) => {
      await storeCredentials({ service: serviceId, ...payload });
      invalidate();
    },
    [invalidate],
  );

  const disconnect = useCallback(
    async (connectionId: string) => {
      await disconnectConnection(connectionId);
      invalidate();
    },
    [invalidate],
  );

  return { oauthConnect, submitCredentials, disconnect };
}
