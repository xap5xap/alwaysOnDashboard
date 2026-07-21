// The add-widget mutation (AOD-139, resolves AOD-103): derives a first-free placement and inserts ONE
// widget_instances row under RLS, OPTIMISTICALLY appending a provisional tile to the dashboard query
// cache before the network resolves (like useRemoveWidget) and swapping in the real row on success. The
// repo + auth are mocked; this proves (1) the provisional is in the cache BEFORE the insert resolves and
// is swapped for the returned real row, (2) a failed insert rolls the provisional back out by id and
// rethrows, and (3) the headline regression — two rapid adds read the provisional and so compute
// NON-OVERLAPPING rects instead of stacking on the same stale slot.
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LoadedDashboard } from '../dashboardRepo';
import type { InstanceSeed } from '../mapper';
import type { GridRect } from '../grid';
import type { WidgetDefinition, WidgetInstance } from '../../registry/types';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }));
jest.mock('../../supabase/client', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../dashboardRepo', () => ({ addWidgetInstance: jest.fn() }));

import { addWidgetInstance } from '../dashboardRepo';
import { useAddWidget } from '../useAddWidget';
import { dashboardQueryKey } from '../useDashboard';
import { cellsOverlap } from '../grid';

const def = (overrides: Partial<WidgetDefinition> = {}): WidgetDefinition => ({
  type: 'placeholder',
  serviceId: 'stub',
  title: 'Stub Widget',
  supportedSizes: ['S', 'W', 'L'], // defaultPlacementSize prefers W (2x1)
  defaultRefresh: { seconds: 300 },
  configSchema: { fields: [] },
  render: () => null,
  ...overrides,
});

const instance = (id: string, rect: WidgetInstance['rect']): WidgetInstance => ({
  instanceId: id,
  serviceId: 'clock',
  widgetType: 'clock',
  config: {},
  size: 'W',
  rect,
});

/** A real row the repo hands back: echoes the seed geometry under a server id (what rowToInstance does). */
const realFromSeed = (id: string, seed: InstanceSeed): WidgetInstance => ({
  instanceId: id,
  serviceId: seed.serviceId,
  widgetType: seed.widgetType,
  config: seed.config,
  rect: seed.rect,
  size: seed.size,
});

const gridCell = (r: WidgetInstance['rect']): GridRect => ({ x: r.x, y: r.y, w: r.w, h: r.h });

function seededClient(instances: WidgetInstance[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData<LoadedDashboard>(dashboardQueryKey('u1'), {
    dashboardId: 'dash-1',
    name: 'Wall',
    instances,
  });
  return client;
}

const instancesInCache = (client: QueryClient) =>
  client.getQueryData<LoadedDashboard>(dashboardQueryKey('u1'))?.instances ?? [];

function renderAdd(client: QueryClient) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAddWidget(), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: the insert echoes the seed as a real row (overridden per-test where the timing matters).
  let n = 0;
  (addWidgetInstance as jest.Mock).mockImplementation(async (_d: string, _u: string, seed: InstanceSeed) =>
    realFromSeed(`real-${(n += 1)}`, seed),
  );
});

describe('useAddWidget optimistic insert (AOD-139)', () => {
  it('appends a provisional tile at the first-free slot before the insert resolves, then swaps in the real row', async () => {
    // A deferred insert so we can observe the cache mid-flight.
    let resolveInsert!: (v: WidgetInstance) => void;
    (addWidgetInstance as jest.Mock).mockReturnValue(
      new Promise<WidgetInstance>((res) => (resolveInsert = res)),
    );

    const client = seededClient([instance('seed-a', { x: 0, y: 0, w: 2, h: 1, z: 0 })]);
    const { result } = renderAdd(client);

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.addWidget(def());
    });

    // The provisional is already in the cache though the network has NOT resolved. It sits at the
    // first-free slot below the seeded W (a W blocks the whole row -> row 1), under a placeholder id.
    const mid = instancesInCache(client);
    expect(mid).toHaveLength(2);
    const provisional = mid[1];
    expect(provisional.instanceId).toMatch(/^pending-/);
    expect(provisional.instanceId).not.toBe('seed-a');
    expect(provisional.rect).toEqual({ x: 0, y: 1, w: 2, h: 1, z: 1 });

    const real = realFromSeed('real-1', {
      serviceId: 'stub',
      widgetType: 'placeholder',
      config: {},
      size: 'W',
      rect: { x: 0, y: 1, w: 2, h: 1, z: 1 },
    });
    await act(async () => {
      resolveInsert(real);
      await pending;
    });

    // The provisional was swapped for the real row (real id), and the seeded tile is untouched.
    const after = instancesInCache(client);
    expect(after.map((i) => i.instanceId)).toEqual(['seed-a', 'real-1']);
    expect(after[1]).toEqual(real);
    expect(result.current.error).toBeNull();
  });

  it('rolls the provisional back out of the cache (by id) and rethrows when the insert fails', async () => {
    (addWidgetInstance as jest.Mock).mockRejectedValue(new Error('rls denied'));
    const client = seededClient([instance('seed-a', { x: 0, y: 0, w: 2, h: 1, z: 0 })]);
    const { result } = renderAdd(client);

    await act(async () => {
      await expect(result.current.addWidget(def())).rejects.toThrow('rls denied');
    });

    // Only the pre-existing tile remains — no phantom provisional left behind.
    expect(instancesInCache(client).map((i) => i.instanceId)).toEqual(['seed-a']);
    await waitFor(() => expect(result.current.error?.message).toBe('rls denied'));
  });

  it('drops the provisional and invalidates when the inserted row cannot be mapped back (null)', async () => {
    (addWidgetInstance as jest.Mock).mockResolvedValue(null);
    const client = seededClient([instance('seed-a', { x: 0, y: 0, w: 2, h: 1, z: 0 })]);
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderAdd(client);

    await act(async () => {
      await result.current.addWidget(def());
    });

    // No placeholder tile lingers, and the truth is reconciled via an invalidate of the dashboard key.
    expect(instancesInCache(client).map((i) => i.instanceId)).toEqual(['seed-a']);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: dashboardQueryKey('u1') });
    expect(result.current.error).toBeNull();
  });

  it('two rapid adds compute NON-OVERLAPPING rects (the 2nd sees the 1st provisional occupying its slot)', async () => {
    // Deferred inserts so BOTH adds derive placement while the other is still in flight — the exact
    // race that produced overlapping cards before AOD-139.
    const resolvers: Array<() => void> = [];
    (addWidgetInstance as jest.Mock).mockImplementation(
      (_d: string, _u: string, seed: InstanceSeed) =>
        new Promise<WidgetInstance>((res) => {
          const idx = resolvers.length;
          resolvers.push(() => res(realFromSeed(`real-${idx + 1}`, seed)));
        }),
    );

    const client = seededClient([]); // empty board: add #1 -> origin, add #2 must find the next slot
    const { result } = renderAdd(client);

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.addWidget(def());
      p2 = result.current.addWidget(def());
    });

    // The two seeds passed to the repo were computed before either insert resolved. add #1 lands the W at
    // the origin; add #2 reads the provisional and stacks below instead of reusing (0,0).
    const seed1 = (addWidgetInstance as jest.Mock).mock.calls[0][2] as InstanceSeed;
    const seed2 = (addWidgetInstance as jest.Mock).mock.calls[1][2] as InstanceSeed;
    expect(seed1.rect).toEqual({ x: 0, y: 0, w: 2, h: 1, z: 0 });
    expect(seed2.rect).toEqual({ x: 0, y: 1, w: 2, h: 1, z: 1 });
    expect(cellsOverlap(gridCell(seed1.rect), gridCell(seed2.rect))).toBe(false);

    // The live cache holds both provisionals, and they do not overlap either.
    const mid = instancesInCache(client);
    expect(mid).toHaveLength(2);
    expect(cellsOverlap(gridCell(mid[0].rect), gridCell(mid[1].rect))).toBe(false);

    await act(async () => {
      resolvers.forEach((r) => r());
      await Promise.all([p1, p2]);
    });

    // Both provisionals were swapped for their real rows, still non-overlapping.
    const after = instancesInCache(client);
    expect(after.map((i) => i.instanceId)).toEqual(['real-1', 'real-2']);
    expect(cellsOverlap(gridCell(after[0].rect), gridCell(after[1].rect))).toBe(false);
  });
});

describe('the optional size override (AOD-148 size-by-seeing)', () => {
  it('lands the card at the overridden size and its matching footprint (not the default placement size)', async () => {
    const client = seededClient([]); // empty board
    const { result } = renderAdd(client);

    await act(async () => {
      await result.current.addWidget(def(), undefined, 'S');
    });

    // The seed the repo received carries the SELECTED size + its 1x1 footprint, not the default W 2x1.
    const seed = (addWidgetInstance as jest.Mock).mock.calls[0][2] as InstanceSeed;
    expect(seed.size).toBe('S');
    expect(seed.rect).toEqual({ x: 0, y: 0, w: 1, h: 1, z: 0 });
  });

  it('keeps the default placement size when no override is passed (no behavior change for other callers)', async () => {
    const client = seededClient([]);
    const { result } = renderAdd(client);

    await act(async () => {
      await result.current.addWidget(def());
    });

    const seed = (addWidgetInstance as jest.Mock).mock.calls[0][2] as InstanceSeed;
    expect(seed.size).toBe('W'); // supportedSizes ['S','W','L'] prefers W
    expect(seed.rect).toEqual({ x: 0, y: 0, w: 2, h: 1, z: 0 });
  });
});
