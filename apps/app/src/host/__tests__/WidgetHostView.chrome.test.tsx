// The AOD-37 host chrome polish on WidgetHostView: the quiet SERVICE · WIDGET header and its suppression,
// the status-and-refresh cluster, the staleness/error captions, and the §7 dim overlay / night-frame
// behavior keyed on the generic dimsWithAmbient flag (never on a service). Complements the existing
// WidgetHostView.test.tsx (which asserts the AOD-10 §7.3 renderer-invocation rule).
import React from 'react';
import { render, screen, within } from '@testing-library/react-native';
import { WidgetHostView } from '../WidgetHostView';
import { AmbientProvider } from '../../ambient/AmbientContext';
import { stubService } from '../../registry/__tests__/stubRegistry';
import type { WidgetViewState } from '../../widgets/lifecycle';

const def = stubService.widgets[0];
const base = { def, size: 'W' as const, config: {}, serviceName: 'Linear' }; // AOD-122 slot id
const live: WidgetViewState = { phase: 'live', data: { hello: 'world' }, fetchedAt: 1 };

describe('WidgetHostView quiet header (AOD-37 §4.2)', () => {
  it('renders the SERVICE · WIDGET title', () => {
    render(<WidgetHostView {...base} state={live} />);
    expect(screen.getByText(`Linear · ${def.title}`)).toBeTruthy();
  });

  it('collapses to one token when the widget title equals the service name (Clock)', () => {
    render(<WidgetHostView {...base} serviceName="Clock" def={{ ...def, title: 'Clock' }} state={live} />);
    expect(screen.getByText('Clock')).toBeTruthy();
  });

  it('suppresses the header at a size the caption hides (hideAtSizes)', () => {
    render(
      <WidgetHostView
        {...base}
        size="S"
        def={{ ...def, caption: { kind: 'serviceWidget', hideAtSizes: ['S'] } }}
        state={live}
      />,
    );
    expect(screen.queryByTestId('widget-header')).toBeNull();
    // the renderer still draws
    expect(screen.getByText(/stub payload/i)).toBeTruthy();
  });

  it('a chromeless caption { kind: hidden } draws no header at any size', () => {
    render(<WidgetHostView {...base} size="W" def={{ ...def, caption: { kind: 'hidden' } }} state={live} />);
    expect(screen.queryByTestId('widget-header')).toBeNull();
    expect(screen.getByText(/stub payload/i)).toBeTruthy();
  });
});

describe('WidgetHostView status + refresh cluster (AOD-37 §5, §6)', () => {
  it('shows the refresh control when the host supplies it, hides it otherwise', () => {
    const { rerender } = render(<WidgetHostView {...base} state={live} />);
    expect(screen.queryByTestId('widget-refresh')).toBeNull();
    rerender(<WidgetHostView {...base} state={live} refresh={{ state: 'idle', onPress: () => {} }} />);
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

describe('WidgetHostView headerless status relocation (AOD-124 §3)', () => {
  const headerless = { ...def, caption: { kind: 'hidden' as const } };
  const stale: WidgetViewState = { phase: 'stale', data: { n: 1 }, fetchedAt: 1 };

  it('relocates the stale dot to the top-trailing corner cluster when the card is headerless', () => {
    render(<WidgetHostView {...base} def={headerless} state={stale} />);
    expect(screen.queryByTestId('widget-header')).toBeNull();
    const corner = screen.getByTestId('widget-corner-status');
    expect(within(corner).getByTestId('widget-stale-dot')).toBeTruthy();
    // the render still draws under the floating cluster
    expect(screen.getByText(/stub payload/i)).toBeTruthy();
  });

  it('surfaces the refresh affordance in the corner on a headerless fetching card', () => {
    render(
      <WidgetHostView {...base} def={headerless} state={live} refresh={{ state: 'idle', onPress: () => {} }} />,
    );
    const corner = screen.getByTestId('widget-corner-status');
    expect(within(corner).getByTestId('widget-refresh')).toBeTruthy();
  });

  it('draws NO corner cluster for a chromeless card with no fetch and no staleness (Clock)', () => {
    render(<WidgetHostView {...base} def={headerless} state={live} />);
    expect(screen.queryByTestId('widget-header')).toBeNull();
    expect(screen.queryByTestId('widget-corner-status')).toBeNull();
  });

  it('keeps the status cluster in the header (not the corner) when a caption shows', () => {
    render(<WidgetHostView {...base} state={stale} />);
    expect(screen.getByTestId('widget-header')).toBeTruthy();
    expect(screen.queryByTestId('widget-corner-status')).toBeNull();
    expect(screen.getByTestId('widget-stale-dot')).toBeTruthy();
  });
});

describe('WidgetHostView dim / ambient (AOD-37 §7)', () => {
  it('paints the global dim overlay at night for a default (dimsWithAmbient) widget', () => {
    render(
      <AmbientProvider value={{ phase: 'night', dimLevel: 0.7 }}>
        <WidgetHostView {...base} state={live} />
      </AmbientProvider>,
    );
    expect(screen.getByTestId('widget-dim-overlay')).toBeTruthy();
  });

  it('paints no overlay by day', () => {
    render(<WidgetHostView {...base} state={live} />);
    expect(screen.queryByTestId('widget-dim-overlay')).toBeNull();
  });

  it('an opt-out widget (dimsWithAmbient: false) gets NO overlay, even at night', () => {
    render(
      <AmbientProvider value={{ phase: 'night', dimLevel: 0.7 }}>
        <WidgetHostView {...base} def={{ ...def, dimsWithAmbient: false }} state={live} />
      </AmbientProvider>,
    );
    expect(screen.queryByTestId('widget-dim-overlay')).toBeNull();
    expect(screen.getByTestId('widget-card')).toBeTruthy();
  });
});
