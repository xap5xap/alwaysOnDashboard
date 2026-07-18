// ClockCard self-tick + the host none no-fetch path + the config seam (integration-clock.md §6.3, §7.2, §5;
// RB-M2 AOD-130 Meridian), mirroring services/weather/__tests__/WeatherCards.test.tsx. The pure formatting
// matrix lives in clockTime.test.ts; this drives the leaf and the real WidgetHost. The host reads
// useConnections() for the platform_key params-seeding; a none widget needs no connection, so an empty map is
// fine (and proves Clock renders with nothing connected).
//
// AOD-130 reface: the face is now a single centered figure (clock-time) with two small satellites — the
// meridiem (clock-meridiem, 12h only) and the seconds whisper (clock-seconds, when showSeconds). The old
// date line (clock-date) and zone kicker (clock-zone) are GONE, so this suite asserts their ABSENCE and the
// new satellites' presence. Because formatClock now runs in device-local time (the timezone override was
// removed) and jest pins no TZ, the cadence tests assert on the offset-independent SECONDS whisper and on
// whether the figure changes, never a hard-coded "14:05".
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClockCard } from '../ClockCard';
import { AmbientProvider } from '../../../../ambient/AmbientContext';
import { clockService } from '..';
import { WidgetHost } from '../../../../host/WidgetHost';
import { WidgetDataSourceProvider, type WidgetDataSource } from '../../../../host/WidgetDataSource';
import { RegistryProvider } from '../../../RegistryProvider';
import type { WidgetInstance, WidgetSize } from '../../../types';
import { validateConfig } from '../../../../widgets/config';
import { tabularWidth } from '../../../../widgets/fitLadder';

jest.mock('../../../../connections/useConnections', () => ({
  useConnections: () => ({ connections: new Map(), isLoading: false, isError: false, error: null }),
}));

/** The current hero figure text (clock-time), with Unicode whitespace normalized. */
function figureText(): string {
  return String(screen.getByTestId('clock-time').props.children).replace(/\s+/g, ' ').trim();
}
/** The current seconds-whisper text (clock-seconds), or null when the whisper is absent. */
function secondsText(): string | null {
  const node = screen.queryByTestId('clock-seconds');
  return node ? String(node.props.children).replace(/\s+/g, ' ').trim() : null;
}

describe('ClockCard self-tick cadence (integration-clock.md §7.2)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('ticks every second when showSeconds is true: the seconds whisper advances 00 -> 01 -> 02', () => {
    // The seconds field is timezone-independent, so 00/01/02 is deterministic on any CI zone; the figure
    // (minute) does not roll across these 3 seconds, proving the whisper carries the 1s cadence, not the figure.
    jest.useFakeTimers({ now: new Date('2026-06-28T14:05:00.000Z') });
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: true }} size="W" />);

    const figure0 = figureText();
    expect(secondsText()).toBe('00');
    act(() => jest.advanceTimersByTime(1000));
    expect(secondsText()).toBe('01');
    act(() => jest.advanceTimersByTime(1000));
    expect(secondsText()).toBe('02');
    expect(figureText()).toBe(figure0); // the hero minute did not roll across 3 seconds
  });

  it('ticks every minute when showSeconds is false: 1s does nothing, 60s rolls the figure (no whisper)', () => {
    jest.useFakeTimers({ now: new Date('2026-06-28T14:05:00.000Z') });
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: false }} size="W" />);

    const figure0 = figureText();
    expect(figure0).toMatch(/^\d{1,2}:\d{2}$/);
    expect(secondsText()).toBeNull(); // no whisper when seconds are off
    act(() => jest.advanceTimersByTime(1000));
    expect(figureText()).toBe(figure0); // unchanged after one second (60s cadence)
    act(() => jest.advanceTimersByTime(60000));
    expect(figureText()).not.toBe(figure0); // the minute rolled after 60s
  });

  it('clears its timers on unmount (no leaked interval)', () => {
    jest.useFakeTimers({ now: new Date('2026-06-28T14:05:00.000Z') });
    const clearInterval = jest.spyOn(globalThis, 'clearInterval');
    const clearTimeout = jest.spyOn(globalThis, 'clearTimeout');
    const view = render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: true }} size="W" />);
    act(() => jest.advanceTimersByTime(1000)); // promote the aligned timeout into a running interval
    view.unmount();
    expect(clearTimeout).toHaveBeenCalled();
    expect(clearInterval).toHaveBeenCalled();
    clearInterval.mockRestore();
    clearTimeout.mockRestore();
  });
});

const clockInstance: WidgetInstance = {
  instanceId: 'clk-1',
  serviceId: 'clock',
  widgetType: 'clock',
  config: {}, // ready on add: every field has a default, no required field (§9.1)
  size: 'W', // AOD-122 slot id (was 'medium'; same 2x1 rect)
  rect: { x: 0, y: 0, w: 2, h: 1, z: 0 },
};

function renderHost(source: WidgetDataSource, instance: WidgetInstance) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <RegistryProvider>
        <WidgetDataSourceProvider source={source}>
          <WidgetHost instance={instance} maxRetries={0} />
        </WidgetDataSourceProvider>
      </RegistryProvider>
    </QueryClientProvider>,
  );
}

describe('WidgetHost authClass:none no-fetch + self-tick path (integration-clock.md §6.3)', () => {
  it('makes NO proxy fetch for a none widget and renders Fresh immediately (no loading)', () => {
    const source: WidgetDataSource = {
      fetch: jest.fn().mockResolvedValue({ data: { ignored: true }, fetchedAt: Date.now() }),
      resolveOptions: jest.fn().mockResolvedValue([]),
    };
    renderHost(source, clockInstance);

    // Live on mount: the card is present and the connecting skeleton never shows.
    expect(screen.getByTestId('clock-card')).toBeTruthy();
    expect(screen.queryByTestId('widget-connecting')).toBeNull();
    // The leaf actually formatted the device clock (a time figure is rendered).
    expect(screen.getByTestId('clock-time').props.children).toBeTruthy();
    // The defining proof: the proxy is never called for a none widget.
    expect(source.fetch).not.toHaveBeenCalled();
  });

  it('is addable with no connection (the addableWidgets none exemption, §3.1)', () => {
    // No connection is mocked (empty map). The widget still resolves and renders, proving none widgets do not
    // gate on a connection. addableWidgets is unit-tested in the registry; this is the host-path proof.
    const source: WidgetDataSource = { fetch: jest.fn(), resolveOptions: jest.fn().mockResolvedValue([]) };
    renderHost(source, clockInstance);
    expect(screen.getByTestId('clock-card')).toBeTruthy();
    expect(screen.queryByTestId('widget-disconnected')).toBeNull();
  });
});

describe('Clock config: ready on add with the two Meridian fields (integration-clock.md §5, §9.1)', () => {
  const clockSchema = clockService.widgets[0].configSchema;

  it('applies defaults for an empty config (ready on add, no required field)', () => {
    const r = validateConfig(clockSchema, {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.clockFormat).toBe('24h');
      expect(r.values.showSeconds).toBe(false);
    }
  });
});

describe('ClockCard Meridian face: a single centered figure, no chrome at any size (AOD-130)', () => {
  const cfg = (o: Record<string, unknown> = {}) => ({ clockFormat: '24h', showSeconds: false, ...o });

  it.each(['S', 'W', 'L'] as WidgetSize[])('%s: the figure alone — the date line and zone kicker are stripped', (size) => {
    render(<ClockCard data={undefined} config={cfg()} size={size} />);
    expect(screen.getByTestId('clock-time')).toBeTruthy();
    // The subtractive reface: neither the old date line nor the second-clock zone kicker exists any more.
    expect(screen.queryByTestId('clock-date')).toBeNull();
    expect(screen.queryByTestId('clock-zone')).toBeNull();
  });

  it('24h without seconds: no meridiem and no seconds whisper (the figure only)', () => {
    render(<ClockCard data={undefined} config={cfg()} size="W" />);
    expect(screen.queryByTestId('clock-meridiem')).toBeNull();
    expect(screen.queryByTestId('clock-seconds')).toBeNull();
  });

  it('12h: the meridiem (AM/PM) rides beside the figure', () => {
    render(<ClockCard data={undefined} config={cfg({ clockFormat: '12h' })} size="W" />);
    const m = String(screen.getByTestId('clock-meridiem').props.children);
    expect(m === 'AM' || m === 'PM').toBe(true);
  });

  it('showSeconds true: the seconds whisper is present', () => {
    render(<ClockCard data={undefined} config={cfg({ showSeconds: true })} size="W" />);
    expect(screen.getByTestId('clock-seconds')).toBeTruthy();
  });

  it('showSeconds false: the seconds whisper is absent', () => {
    render(<ClockCard data={undefined} config={cfg({ showSeconds: false })} size="W" />);
    expect(screen.queryByTestId('clock-seconds')).toBeNull();
  });

  it('24h with seconds: the whisper shows as the trailing figure, with no meridiem', () => {
    render(<ClockCard data={undefined} config={cfg({ showSeconds: true })} size="W" />);
    expect(screen.getByTestId('clock-seconds')).toBeTruthy();
    expect(screen.queryByTestId('clock-meridiem')).toBeNull();
  });
});

describe('ClockCard width-fit: the figure never clips (AOD-95/97, preserved through the Meridian reface)', () => {
  /** The fitted font size the hero figure rendered at. */
  const timeSize = () => screen.getByTestId('clock-time').props.style.fontSize as number;

  it('AOD-95: at S the composite scales the figure BELOW its 34px step so it fits the 72px width', () => {
    // Direct render -> the S fallback box is 72x72 (chromeless). clockSize.small is 34; "18:45" alone is ~96px
    // at 34px (and the seconds satellite adds more), so the width-fit must scale it down. Before AOD-95 it clipped.
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: true }} size="S" />);
    expect(timeSize()).toBeLessThan(34); // scaled down to fit the narrow cell
    expect(timeSize()).toBeGreaterThan(0);
  });

  it('AOD-97: at L the figure fits the cell WIDTH rather than overflowing it at the 96px step', () => {
    // The clockSize steps are sized for the wall; a 96px "14:05" is ~270px, far wider than the 168px L body,
    // so the old fixed step overflowed/clipped. The width-fit scales it to fit the width — no clip.
    render(<ClockCard data={undefined} config={{ clockFormat: '24h', showSeconds: false }} size="L" />);
    const size = timeSize();
    expect(size).toBeLessThanOrEqual(96);
    expect(tabularWidth('14:05', size)).toBeLessThanOrEqual(168 + 0.001); // fits the L body width
  });
});

describe('ClockCard night palette + the receding satellites (AOD-37 §8.5; AOD-130 recession)', () => {
  it('at phase night the figure is the deep-red ember and the satellites recede a step (roles, not hexes)', () => {
    render(
      <AmbientProvider value={{ phase: 'night', dimLevel: 0.7 }}>
        <ClockCard data={undefined} config={{ clockFormat: '12h', showSeconds: true }} size="W" />
      </AmbientProvider>,
    );
    // §3.2 night.primary is the deep red the figure swaps to at night; the meridiem recedes to night.secondary
    // and the seconds whisper to night.muted, dimmer still via secondsOpacity.
    expect(screen.getByTestId('clock-time').props.style.color).toBe('#C2362B'); // night.primary
    expect(screen.getByTestId('clock-meridiem').props.style.color).toBe('#8A201B'); // night.secondary
    const seconds = screen.getByTestId('clock-seconds');
    expect(seconds.props.style.color).toBe('#5E1714'); // night.muted
    expect(seconds.props.style.opacity).toBe(0.5); // the whisper recedes further (meridian.secondsOpacity)
  });

  it('by day the figure is bone and both satellites recede to textMuted', () => {
    render(<ClockCard data={undefined} config={{ clockFormat: '12h', showSeconds: true }} size="W" />);
    expect(screen.getByTestId('clock-time').props.style.color).toBe('#F4F4F8'); // colors.text (bone)
    expect(screen.getByTestId('clock-meridiem').props.style.color).toBe('#9B9BA8'); // colors.textMuted
    expect(screen.getByTestId('clock-seconds').props.style.color).toBe('#9B9BA8'); // colors.textMuted
  });
});
