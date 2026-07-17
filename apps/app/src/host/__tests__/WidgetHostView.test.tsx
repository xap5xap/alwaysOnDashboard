// Component-band tests for the host chrome across every AOD-10 §7 lifecycle state, asserting the
// AOD-10 §7.3 rule: the widget's own renderer is reached ONLY on data-bearing states (testing-
// strategy §9). Uses the test-only stub widget definition (its StubCard renderer) as the leaf.
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { WidgetHostView } from '../WidgetHostView';
import { stubService } from '../../registry/__tests__/stubRegistry';
import type { WidgetDefinition, WidgetRenderProps } from '../../registry/types';

const def = stubService.widgets[0];
const base = { def, size: 'W' as const, config: {}, serviceName: 'Stub' }; // AOD-122 slot id

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

// AOD-123 acceptance #3: the host computes the body px box from the slot rect (UNIT_PX 96 * nominal units,
// minus card padding on both axes and — when shown — the header row + gap) and passes it to the renderer,
// so FitBody never measures on the always-on hot path. A box-echoing renderer proves both the pass-through
// and the arithmetic (padding spacing(3)=12 both sides; header 16 + gap spacing(2)=8 when the header shows).
describe('WidgetHostView passes the computed body box to the renderer (AOD-123 §3)', () => {
  function boxEchoDef(overrides?: Partial<WidgetDefinition>): WidgetDefinition {
    const Echo = ({ box }: WidgetRenderProps) => <Text testID="echo-box">{box ? `${box.width}x${box.height}` : 'no-box'}</Text>;
    return { ...def, render: Echo, ...overrides };
  }
  const fresh = { phase: 'fresh' as const, data: {}, fetchedAt: 1 };

  it('W (2x1) with the header shown: 168 x 48 (192-24 wide, 96-24-24 tall)', () => {
    render(<WidgetHostView {...base} def={boxEchoDef()} size="W" state={fresh} />);
    expect(screen.getByTestId('echo-box')).toHaveTextContent('168x48');
  });

  it('L (2x2) with the header shown: 168 x 144', () => {
    render(<WidgetHostView {...base} def={boxEchoDef()} size="L" state={fresh} />);
    expect(screen.getByTestId('echo-box')).toHaveTextContent('168x144');
  });

  it('S (1x1) header size-suppressed via caption hideAtSizes: 72 x 72 (no header subtraction)', () => {
    render(
      <WidgetHostView
        {...base}
        def={boxEchoDef({ caption: { kind: 'serviceWidget', hideAtSizes: ['S'] } })}
        size="S"
        state={fresh}
      />,
    );
    expect(screen.getByTestId('echo-box')).toHaveTextContent('72x72');
  });

  it('S (1x1) chromeless caption { kind: hidden }: 72 x 72 (no header subtraction, AOD-124 §2)', () => {
    render(<WidgetHostView {...base} def={boxEchoDef({ caption: { kind: 'hidden' } })} size="S" state={fresh} />);
    expect(screen.getByTestId('echo-box')).toHaveTextContent('72x72');
  });

  it('W (2x1) chromeless caption keeps the full width but drops the header row: 168 x 72', () => {
    render(<WidgetHostView {...base} def={boxEchoDef({ caption: { kind: 'hidden' } })} size="W" state={fresh} />);
    expect(screen.getByTestId('echo-box')).toHaveTextContent('168x72');
  });
});
