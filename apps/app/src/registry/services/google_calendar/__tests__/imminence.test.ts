// AOD-136: the Dressed Overall imminence ladder (imminence.ts). Locks the pure contract the two Calendar
// leaves compose — an event's minutes-to-start -> a theme.when stop — as an executable spec. Pure +
// React-free, so no host/render needed; the LEAF binding of theme.when[stop] to the time numeral is locked
// separately in CalendarCards.test.tsx. The thresholds asserted here ARE the frozen truth (the PDF anchors
// are approximate).
import { imminenceStop, minutesUntilStart } from '../imminence';
import type { CalendarEvent } from '../types';

// A fixed device-local "now" so every delta below is exact and DST-independent (the ISO start round-trips
// through the epoch, so minutesUntilStart returns precisely the delta we built).
const NOW = new Date(2026, 6, 18, 12, 0, 0);

function timedAt(deltaMin: number): CalendarEvent {
  const start = new Date(NOW.getTime() + deltaMin * 60000).toISOString();
  return { id: `e${deltaMin}`, summary: 'E', location: null, start, end: start, allDay: false, htmlLink: '' };
}
function allDayEvent(): CalendarEvent {
  return { id: 'ad', summary: 'A', location: null, start: '2026-07-18', end: '2026-07-18', allDay: true, htmlLink: '' };
}
function badStart(): CalendarEvent {
  return { id: 'bad', summary: 'B', location: null, start: 'not-a-date', end: '', allDay: false, htmlLink: '' };
}

describe('minutesUntilStart (the shared delta behind the kicker text + the imminence hue)', () => {
  it('is the whole-minute signed delta for a timed event (negative once begun)', () => {
    expect(minutesUntilStart(timedAt(30), NOW)).toBe(30);
    expect(minutesUntilStart(timedAt(0), NOW)).toBe(0);
    expect(minutesUntilStart(timedAt(-15), NOW)).toBe(-15);
  });

  it('is null when there is no time anchor to measure (all-day) or the start is unparseable (NaN)', () => {
    expect(minutesUntilStart(allDayEvent(), NOW)).toBeNull();
    expect(minutesUntilStart(badStart(), NOW)).toBeNull();
  });
});

describe('imminenceStop (minutes-to-start -> a theme.when stop, cool far -> warm near)', () => {
  it('maps a representative value in each band to its stop', () => {
    expect(imminenceStop(timedAt(600), NOW)).toBe('distant'); // 10h
    expect(imminenceStop(timedAt(240), NOW)).toBe('far'); // 4h
    expect(imminenceStop(timedAt(120), NOW)).toBe('approaching'); // 2h
    expect(imminenceStop(timedAt(75), NOW)).toBe('near'); // 75m
    expect(imminenceStop(timedAt(40), NOW)).toBe('soon'); // 40m
    expect(imminenceStop(timedAt(10), NOW)).toBe('now'); // 10m
  });

  it('a happening-now or already-begun (past) event is warmest (`now`)', () => {
    expect(imminenceStop(timedAt(0), NOW)).toBe('now');
    expect(imminenceStop(timedAt(-60), NOW)).toBe('now'); // started an hour ago, still `now`
  });

  it('each threshold lands at the cool edge of its band (the frozen boundaries)', () => {
    expect(imminenceStop(timedAt(19), NOW)).toBe('now');
    expect(imminenceStop(timedAt(20), NOW)).toBe('soon');
    expect(imminenceStop(timedAt(59), NOW)).toBe('soon');
    expect(imminenceStop(timedAt(60), NOW)).toBe('near');
    expect(imminenceStop(timedAt(89), NOW)).toBe('near');
    expect(imminenceStop(timedAt(90), NOW)).toBe('approaching');
    expect(imminenceStop(timedAt(179), NOW)).toBe('approaching');
    expect(imminenceStop(timedAt(180), NOW)).toBe('far');
    expect(imminenceStop(timedAt(359), NOW)).toBe('far');
    expect(imminenceStop(timedAt(360), NOW)).toBe('distant');
  });

  it('warms monotonically as the event nears (a decreasing-delta sequence yields the stop order)', () => {
    const order = ['distant', 'far', 'approaching', 'near', 'soon', 'now'];
    const stops = [600, 240, 120, 75, 40, 10].map((d) => imminenceStop(timedAt(d), NOW));
    expect(stops).toEqual(order);
  });

  it('parks a bad / NaN / all-day start at the calm `distant` end, never crashes (all-day does not ride)', () => {
    expect(imminenceStop(badStart(), NOW)).toBe('distant');
    expect(imminenceStop(allDayEvent(), NOW)).toBe('distant');
  });
});
