// The reconfigure mutation (AOD-10 §4): persist one instance's config under RLS, then invalidate the
// dashboard query so the board repaints and the host re-derives needsConfig (AOD-10 §4.4) -- an
// instance that was needs_config becomes renderable once its config validates; a still-invalid config
// stays needs_config. Mirrors useAddWidget's persist-then-invalidate shape (no optimistic cache write,
// so the cold-start query persister Map gotcha never applies here). Registry-free: the caller (the
// dashboard's reconfigure entry) passes the validated values; this only persists them.
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { persistInstanceConfig } from './dashboardRepo';
import { dashboardQueryPrefix } from './useDashboard';

export interface UseConfigureInstanceResult {
  /** Persist `config` for `instanceId`, then repaint. Throws on failure (also surfaced via `error`) so
   *  the caller can keep the form open. */
  configure(instanceId: string, config: Record<string, unknown>): Promise<void>;
  pending: boolean;
  error: Error | null;
}

export function useConfigureInstance(): UseConfigureInstanceResult {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const configure = useCallback(
    async (instanceId: string, config: Record<string, unknown>) => {
      if (!userId) throw new Error('Not signed in');
      setPending(true);
      setError(null);
      try {
        await persistInstanceConfig(instanceId, config);
        // Repaint from the server so the host re-derives needsConfig from the persisted row. AOD-197 (Pass
        // B2): config is orientation-INDEPENDENT, so reconcile BOTH orientations via the prefix (a partial
        // match on ['dashboard', userId, *] — landscape AND portrait).
        await queryClient.invalidateQueries({ queryKey: dashboardQueryPrefix(userId) });
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [queryClient, userId],
  );

  return { configure, pending, error };
}
