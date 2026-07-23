// Component-band tests for the host chrome across every AOD-10 §7 lifecycle state, asserting the
// AOD-10 §7.3 rule: the widget's own renderer is reached ONLY on data-bearing states (testing-
// strategy §9). Uses the test-only stub widget definition (its StubCard renderer) as the leaf.
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render, screen, within } from '@testing-library/react-native';
import { WidgetHostView } from '../WidgetHostView';
import { stubService } from '../../registry/__tests__/stubRegistry';
import type { WidgetDefinition, WidgetRenderProps } from '../../registry/types';
import { UNIT_PX } from '../../layout/geometry';

const def = stubService.widgets[0];
const base = { def, size: 'W' as const, config: {}, serviceName: 'Stub' }; // AOD-122 slot id

describe('WidgetHostView lifecycle rendering (AOD-10 §7.3, AOD-125 six states, testing-strategy §9)', () => {
  it('connecting: host skeleton, renderer NOT invoked (was `loading`)', () => {
    render(<WidgetHostView {...base} state={{ phase: 'connecting' }} />);
    expect(screen.getByTestId('widget-connecting')).toBeTruthy();
    expect(screen.queryByText(/stub payload/i)).toBeNull();
  });

  it('ghost: host-drawn not-yet-lit placeholder, renderer NOT invoked (AOD-125)', () => {
    render(<WidgetHostView {...base} state={{ phase: 'ghost' }} />);
    expect(screen.getByTestId('widget-ghost')).toBeTruthy();
    expect(screen.getByText('Not yet lit')).toBeTruthy();
    expect(screen.queryByText(/stub payload/i)).toBeNull();
    // action-less by design (unlike disconnected): no button in the ghost placeholder
    expect(within(screen.getByTestId('widget-ghost')).queryByRole('button')).toBeNull();
  });

  it('empty: host-drawn shared EmptyBody, the generic fallback line when the def has no emptyCopy (AOD-125/AOD-136)', () => {
    // The stub def declares no emptyCopy, so the host falls back to the generic plain words — the seam
    // guarantees no widget without emptyCopy regresses off "Nothing right now."
    render(<WidgetHostView {...base} state={{ phase: 'empty', data: {}, fetchedAt: 1 }} />);
    expect(screen.getByTestId('widget-empty-body')).toBeTruthy();
    expect(screen.getByText('Nothing right now.')).toBeTruthy();
    expect(screen.queryByText(/stub payload/i)).toBeNull();
    // the empty body carries NO action (the trait separating it from the host prompts)
    expect(within(screen.getByTestId('widget-empty-body')).queryByRole('button')).toBeNull();
  });

  it('empty: the host passes a def.emptyCopy line + subline through to EmptyBody (AOD-136 seam)', () => {
    // A widget that names its own plain words (as the Calendar defs do) sees them instead of the generic
    // line; the host reads def.emptyCopy and forwards it to the shared EmptyBody.
    const withCopy: WidgetDefinition = { ...def, emptyCopy: { line: 'Nothing next', subline: "You're clear" } };
    render(<WidgetHostView {...base} def={withCopy} state={{ phase: 'empty', data: {}, fetchedAt: 1 }} />);
    expect(screen.getByText('Nothing next')).toBeTruthy();
    expect(screen.getByText("You're clear")).toBeTruthy();
    expect(screen.queryByText('Nothing right now.')).toBeNull(); // the generic fallback is overridden
  });

  it('live: invokes the widget renderer with data (was `fresh`)', () => {
    render(<WidgetHostView {...base} state={{ phase: 'live', data: { hello: 'world' }, fetchedAt: 1 }} />);
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
        state={{ phase: 'error', error: { kind: 'service_error' }, data: { n: 1 }, fetchedAt: 1 }}
      />,
    );
    expect(screen.getByTestId('widget-error-dot')).toBeTruthy();
    expect(screen.getByText(/stub payload/i)).toBeTruthy();
  });

  it('error without data: host placeholder, renderer NOT invoked', () => {
    render(<WidgetHostView {...base} state={{ phase: 'error', error: { kind: 'service_error' } }} />);
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

// AOD-203: the card frame carries NO minWidth floor. A w=1 footprint is UNIT_PX (96 DP) wide, so the old 160
// DP floor forced a w=1 card 1.67x past its column and overflowed its neighbour (on the handheld canvas AND
// the wall). Since AOD-123 the leaf fits its own content to the host-passed box, so no width floor is needed:
// the card fills its footprint and never exceeds it. Lock the removal so the overflow cannot regress.
describe('WidgetHostView card carries no width floor (AOD-203)', () => {
  it('the card sets no minWidth, so a w=1 (96 DP) footprint is never overflowed', () => {
    render(<WidgetHostView {...base} size="S" state={{ phase: 'live', data: {}, fetchedAt: 1 }} />);
    const style = StyleSheet.flatten(screen.getByTestId('widget-card').props.style);
    expect(style.minWidth).toBeUndefined();
  });

  it('any width floor present would have to stay within the w=1 footprint (<= UNIT_PX)', () => {
    // Defense in depth: even if a future backstop re-adds a minWidth, it must never exceed a w=1 cell.
    render(<WidgetHostView {...base} size="S" state={{ phase: 'live', data: {}, fetchedAt: 1 }} />);
    const style = StyleSheet.flatten(screen.getByTestId('widget-card').props.style);
    if (style.minWidth != null) expect(style.minWidth).toBeLessThanOrEqual(UNIT_PX);
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
  const live = { phase: 'live' as const, data: {}, fetchedAt: 1 };

  it('W (2x1) with the header shown: 168 x 48 (192-24 wide, 96-24-24 tall)', () => {
    render(<WidgetHostView {...base} def={boxEchoDef()} size="W" state={live} />);
    expect(screen.getByTestId('echo-box')).toHaveTextContent('168x48');
  });

  it('L (2x2) with the header shown: 168 x 144', () => {
    render(<WidgetHostView {...base} def={boxEchoDef()} size="L" state={live} />);
    expect(screen.getByTestId('echo-box')).toHaveTextContent('168x144');
  });

  it('S (1x1) header size-suppressed via caption hideAtSizes: 72 x 72 (no header subtraction)', () => {
    render(
      <WidgetHostView
        {...base}
        def={boxEchoDef({ caption: { kind: 'serviceWidget', hideAtSizes: ['S'] } })}
        size="S"
        state={live}
      />,
    );
    expect(screen.getByTestId('echo-box')).toHaveTextContent('72x72');
  });

  it('S (1x1) chromeless caption { kind: hidden }: 72 x 72 (no header subtraction, AOD-124 §2)', () => {
    render(<WidgetHostView {...base} def={boxEchoDef({ caption: { kind: 'hidden' } })} size="S" state={live} />);
    expect(screen.getByTestId('echo-box')).toHaveTextContent('72x72');
  });

  it('W (2x1) chromeless caption keeps the full width but drops the header row: 168 x 72', () => {
    render(<WidgetHostView {...base} def={boxEchoDef({ caption: { kind: 'hidden' } })} size="W" state={live} />);
    expect(screen.getByTestId('echo-box')).toHaveTextContent('168x72');
  });
});
