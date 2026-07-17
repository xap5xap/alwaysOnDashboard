// The AOD-37 host chrome polish on WidgetHostView: the quiet SERVICE · WIDGET header and its suppression,
// the status-and-refresh cluster, the staleness/error captions, and the §7 dim overlay / night-frame
// behavior keyed on the generic dimsWithAmbient flag (never on a service). Complements the existing
// WidgetHostView.test.tsx (which asserts the AOD-10 §7.3 renderer-invocation rule).
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { WidgetHostView } from '../WidgetHostView';
import { AmbientProvider } from '../../ambient/AmbientContext';
import { stubService } from '../../registry/__tests__/stubRegistry';
import type { WidgetViewState } from '../../widgets/lifecycle';

const def = stubService.widgets[0];
const base = { def, size: 'W' as const, config: {}, serviceName: 'Linear' }; // AOD-122 slot id
const fresh: WidgetViewState = { phase: 'fresh', data: { hello: 'world' }, fetchedAt: 1 };

describe('WidgetHostView quiet header (AOD-37 §4.2)', () => {
  it('renders the SERVICE · WIDGET title', () => {
    render(<WidgetHostView {...base} state={fresh} />);
    expect(screen.getByText(`Linear · ${def.title}`)).toBeTruthy();
  });

  it('collapses to one token when the widget title equals the service name (Clock)', () => {
    render(<WidgetHostView {...base} serviceName="Clock" def={{ ...def, title: 'Clock' }} state={fresh} />);
    expect(screen.getByText('Clock')).toBeTruthy();
  });

  it('suppresses the header at a size the widget declares (Clock S)', () => {
    render(
      <WidgetHostView {...base} size="S" def={{ ...def, hideHeaderAtSizes: ['S'] }} state={fresh} />,
    );
    expect(screen.queryByTestId('widget-header')).toBeNull();
    // the renderer still draws
    expect(screen.getByText(/stub payload/i)).toBeTruthy();
  });
});

describe('WidgetHostView status + refresh cluster (AOD-37 §5, §6)', () => {
  it('shows the refresh control when the host supplies it, hides it otherwise', () => {
    const { rerender } = render(<WidgetHostView {...base} state={fresh} />);
    expect(screen.queryByTestId('widget-refresh')).toBeNull();
    rerender(<WidgetHostView {...base} state={fresh} refresh={{ state: 'idle', onPress: () => {} }} />);
    expect(screen.getByTestId('widget-refresh')).toBeTruthy();
  });

  it('stale: amber dot + an "updated Nm ago" caption', () => {
    const NOW = 10 * 60 * 1000;
    render(
      <WidgetHostView
        {...base}
        now={() => NOW}
        state={{ phase: 'stale', data: { n: 1 }, fetchedAt: NOW - 2 * 60 * 1000 }}
      />,
    );
    expect(screen.getByTestId('widget-stale-dot')).toBeTruthy();
    expect(screen.getByText('updated 2m ago')).toBeTruthy();
  });

  it('error with data: red dot + a "could not refresh" caption', () => {
    render(
      <WidgetHostView
        {...base}
        state={{ phase: 'error', error: { kind: 'provider_unavailable' }, data: { n: 1 }, fetchedAt: 1 }}
      />,
    );
    expect(screen.getByTestId('widget-error-dot')).toBeTruthy();
    expect(screen.getByText('couldn’t refresh')).toBeTruthy();
  });
});

describe('WidgetHostView dim / ambient (AOD-37 §7)', () => {
  it('paints the global dim overlay at night for a default (dimsWithAmbient) widget', () => {
    render(
      <AmbientProvider value={{ phase: 'night', dimLevel: 0.7 }}>
        <WidgetHostView {...base} state={fresh} />
      </AmbientProvider>,
    );
    expect(screen.getByTestId('widget-dim-overlay')).toBeTruthy();
  });

  it('paints no overlay by day', () => {
    render(<WidgetHostView {...base} state={fresh} />);
    expect(screen.queryByTestId('widget-dim-overlay')).toBeNull();
  });

  it('an opt-out widget (dimsWithAmbient: false) gets NO overlay, even at night', () => {
    render(
      <AmbientProvider value={{ phase: 'night', dimLevel: 0.7 }}>
        <WidgetHostView {...base} def={{ ...def, dimsWithAmbient: false }} state={fresh} />
      </AmbientProvider>,
    );
    expect(screen.queryByTestId('widget-dim-overlay')).toBeNull();
    expect(screen.getByTestId('widget-card')).toBeTruthy();
  });
});
