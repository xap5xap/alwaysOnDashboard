// Component-band tests for the host chrome across every AOD-10 §7 lifecycle state, asserting the
// AOD-10 §7.3 rule: the widget's own renderer is reached ONLY on data-bearing states (testing-
// strategy §9). Uses the real stub widget definition (its StubCard renderer) as the leaf.
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { WidgetHostView } from '../WidgetHostView';
import { stubService } from '../../registry/services/stub';

const def = stubService.widgets[0];
const base = { def, size: 'medium' as const, config: {}, serviceName: 'Stub' };

describe('WidgetHostView lifecycle rendering (AOD-10 §7.3, testing-strategy §9)', () => {
  it('loading: host skeleton, renderer NOT invoked', () => {
    render(<WidgetHostView {...base} state={{ phase: 'loading' }} />);
    expect(screen.getByTestId('widget-loading')).toBeTruthy();
    expect(screen.queryByText(/stub payload/i)).toBeNull();
  });

  it('fresh: invokes the widget renderer with data', () => {
    render(<WidgetHostView {...base} state={{ phase: 'fresh', data: { hello: 'world' }, fetchedAt: 1 }} />);
    expect(screen.getByText(/stub payload/i)).toBeTruthy();
    expect(screen.getByText(/hello/)).toBeTruthy();
  });

  it('stale: renders last-known data plus a host amber status dot (AOD-37 §5)', () => {
    render(<WidgetHostView {...base} state={{ phase: 'stale', data: { n: 1 }, fetchedAt: 1 }} />);
    expect(screen.getByTestId('widget-stale-dot')).toBeTruthy();
    expect(screen.getByText(/stub payload/i)).toBeTruthy();
  });

  it('error with data: renders last-known data plus a host red status dot (AOD-37 §5)', () => {
    render(
      <WidgetHostView
        {...base}
        state={{ phase: 'error', error: { kind: 'provider_unavailable' }, data: { n: 1 }, fetchedAt: 1 }}
      />,
    );
    expect(screen.getByTestId('widget-error-dot')).toBeTruthy();
    expect(screen.getByText(/stub payload/i)).toBeTruthy();
  });

  it('error without data: host placeholder, renderer NOT invoked', () => {
    render(<WidgetHostView {...base} state={{ phase: 'error', error: { kind: 'provider_unavailable' } }} />);
    expect(screen.getByTestId('widget-error')).toBeTruthy();
    expect(screen.queryByText(/stub payload/i)).toBeNull();
  });

  it('needs_config: host reconfigure prompt, renderer NOT invoked', () => {
    render(<WidgetHostView {...base} state={{ phase: 'needs_config' }} />);
    expect(screen.getByTestId('widget-needs-config')).toBeTruthy();
    expect(screen.queryByText(/stub payload/i)).toBeNull();
  });

  it('disconnected: host connect prompt names the service, renderer NOT invoked', () => {
    render(<WidgetHostView {...base} state={{ phase: 'disconnected', status: 'reauth_required' }} />);
    expect(screen.getByTestId('widget-disconnected')).toBeTruthy();
    expect(screen.getByText(/Connect Stub to use this/)).toBeTruthy();
    expect(screen.queryByText(/stub payload/i)).toBeNull();
  });
});
