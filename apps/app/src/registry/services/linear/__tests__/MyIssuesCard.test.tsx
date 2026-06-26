// MyIssuesCard driven through the real WidgetHost + the registry + TanStack Query + a mock
// WidgetDataSource (testing-strategy §9, mirroring host/__tests__/WidgetHost.test.tsx). Proves the
// Linear my_issues path end to end on the client: loading -> fresh renders the issues, the empty state,
// the 409 -> disconnected mapping, and the AOD-10 §4.4 render-time projectId membership re-check.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import type { WidgetInstance } from '../../../types';
import type { MyIssuesData } from '../MyIssuesCard';

const baseInstance: WidgetInstance = {
  instanceId: 'li1',
  serviceId: 'linear',
  widgetType: 'my_issues',
  config: { projectId: 'p1', filter: 'open' },
  size: 'medium',
  rect: { x: 0, y: 0, w: 2, h: 2, z: 0 },
};

// The projectId picker resolves through the same seam; p1 is a member so the config validates.
const projectChoices = [{ value: 'p1', label: 'Platform & App Shell' }];

const sampleData: MyIssuesData = {
  issues: [
    { id: 'i1', identifier: 'AOD-55', title: 'Wire Linear My Issues', url: 'u1', stateName: 'In Progress', stateType: 'started', priority: 2, priorityLabel: 'High', dueDate: null },
    { id: 'i2', identifier: 'AOD-30', title: 'Linear widget visual design', url: 'u2', stateName: 'Todo', stateType: 'unstarted', priority: 3, priorityLabel: 'Medium', dueDate: null },
  ],
  totalCount: 2,
};

function renderHost(source: WidgetDataSource, config: Record<string, unknown> = baseInstance.config) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RegistryProvider>
        <WidgetDataSourceProvider source={source}>
          <WidgetHost instance={{ ...baseInstance, config }} maxRetries={0} />
        </WidgetDataSourceProvider>
      </RegistryProvider>
    </QueryClientProvider>,
  );
}

describe('Linear My Issues through the host lifecycle (AOD-55)', () => {
  it('resolves loading -> fresh and renders the assigned issues with the configured params', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: sampleData, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices),
    };
    renderHost(source);

    expect(screen.getByTestId('widget-loading')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('linear-myissues')).toBeTruthy());
    expect(screen.getByText('AOD-55')).toBeTruthy();
    expect(screen.getByText('Wire Linear My Issues')).toBeTruthy();
    expect(source.fetch).toHaveBeenCalledWith({
      serviceId: 'linear',
      widgetType: 'my_issues',
      params: { projectId: 'p1', filter: 'open' },
    });
  });

  it('renders the empty state when there are no assigned issues', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { issues: [], totalCount: 0 }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices),
    };
    renderHost(source);
    await waitFor(() => expect(screen.getByTestId('linear-myissues-empty')).toBeTruthy());
    expect(screen.queryByTestId('linear-myissues')).toBeNull();
  });

  it('maps a needs_reconnect proxy error (409) to the disconnected state, no card', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockRejectedValue({ kind: 'needs_reconnect' }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices),
    };
    renderHost(source);
    await waitFor(() => expect(screen.getByTestId('widget-disconnected')).toBeTruthy());
    expect(screen.queryByTestId('linear-myissues')).toBeNull();
  });

  it('surfaces needs_config when the stored projectId is no longer a member (AOD-10 §4.4)', async () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: sampleData, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue(projectChoices), // only p1; the stored 'ghost' is gone
    };
    renderHost(source, { projectId: 'ghost', filter: 'open' });
    await screen.findByTestId('widget-needs-config');
    expect(screen.queryByTestId('linear-myissues')).toBeNull();
  });
});
