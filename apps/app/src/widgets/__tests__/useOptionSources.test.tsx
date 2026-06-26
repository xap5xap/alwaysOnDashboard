// The client remote-options resolver hook (AOD-10 §4.3). It runs one query per remote-options field
// through the WidgetDataSource seam and maps each to a per-field state + the ready choice sets. These
// tests inject a mock data source and assert the loading -> ready / error / needs_reconnect mapping and
// that a schema with no remote-options field issues no resolveOptions call.
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOptionSources } from '../useOptionSources';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../host/WidgetDataSource';
import type { Choice, WidgetConfigSchema } from '../../registry/types';

function makeWrapper(source: WidgetDataSource) {
  // retryDelay 0 so a rejected option query settles its retries instantly (no fake timers).
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retryDelay: 0 } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <WidgetDataSourceProvider source={source}>{children}</WidgetDataSourceProvider>
      </QueryClientProvider>
    );
  };
}

const remoteSchema: WidgetConfigSchema = {
  fields: [
    { key: 'project', label: 'Project', kind: 'remote-options', required: true, source: { optionSource: 'stub_options' } },
  ],
};

describe('useOptionSources (AOD-10 §4.3)', () => {
  it('issues no resolveOptions call for a schema with no remote-options field', () => {
    const source: WidgetDataSource = { fetch: jest.fn(), resolveOptions: jest.fn() };
    const { result } = renderHook(
      () => useOptionSources({ fields: [{ key: 'n', label: 'N', kind: 'string', required: false }] }, 'stub'),
      { wrapper: makeWrapper(source) },
    );
    expect(result.current.byField).toEqual({});
    expect(result.current.resolved).toEqual({});
    expect(source.resolveOptions).not.toHaveBeenCalled();
  });

  it('resolves a field to ready choices keyed by field key and calls the seam with the request', async () => {
    const choices: Choice[] = [{ value: 'alpha', label: 'Alpha' }];
    const source: WidgetDataSource = { fetch: jest.fn(), resolveOptions: jest.fn().mockResolvedValue(choices) };
    const { result } = renderHook(() => useOptionSources(remoteSchema, 'stub'), { wrapper: makeWrapper(source) });

    expect(result.current.byField.project.status).toBe('loading');
    await waitFor(() => expect(result.current.byField.project.status).toBe('ready'));
    expect(result.current.resolved.project).toEqual(choices);
    expect(source.resolveOptions).toHaveBeenCalledWith({
      serviceId: 'stub',
      optionSource: 'stub_options',
      params: {},
    });
  });

  it('maps a typed provider error to an error state (with the field absent from resolved)', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn(),
      resolveOptions: jest.fn().mockRejectedValue({ kind: 'provider_unavailable' }),
    };
    const { result } = renderHook(() => useOptionSources(remoteSchema, 'stub'), { wrapper: makeWrapper(source) });
    await waitFor(() => expect(result.current.byField.project.status).toBe('error'));
    expect(result.current.resolved.project).toBeUndefined();
  });

  it('maps a 409 to a needs_reconnect state', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn(),
      resolveOptions: jest.fn().mockRejectedValue({ kind: 'needs_reconnect' }),
    };
    const { result } = renderHook(() => useOptionSources(remoteSchema, 'stub'), { wrapper: makeWrapper(source) });
    await waitFor(() => expect(result.current.byField.project.status).toBe('needs_reconnect'));
  });
});
