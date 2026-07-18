// The pure Linear leaf helpers, tested directly with no layout/render pass (the AOD-64 barMetrics pattern):
// the priority -> glyph-shape mapping (§4), the progress percent clamp (§6.1), and the two relative-date
// formatters (the due date §5.2, the cycle "ends in N days" §6.2). design-linear.md.
import { priorityShape } from '../glyphs';
import { formatDue } from '../MyIssuesCard';
import { clampPercent, endsInLabel } from '../CurrentCycleCard';

describe('priorityShape (design-linear.md §4.2: level carried by shape, filled-bar count = level)', () => {
  it('maps each Linear priority value to its glyph shape', () => {
    expect(priorityShape(0)).toEqual({ kind: 'none', filled: 0 }); // no priority -> dim dashes
    expect(priorityShape(1)).toEqual({ kind: 'urgent', filled: 0 }); // urgent -> the filled block
    expect(priorityShape(2)).toEqual({ kind: 'bars', filled: 3 }); // high -> 3 filled bars
    expect(priorityShape(3)).toEqual({ kind: 'bars', filled: 2 }); // medium -> 2 filled bars
    expect(priorityShape(4)).toEqual({ kind: 'bars', filled: 1 }); // low -> 1 filled bar
  });

  it('defaults any out-of-range value to none (a partial payload never crashes the row)', () => {
    expect(priorityShape(99)).toEqual({ kind: 'none', filled: 0 });
    expect(priorityShape(-1)).toEqual({ kind: 'none', filled: 0 });
    expect(priorityShape(NaN)).toEqual({ kind: 'none', filled: 0 });
  });
});

describe('clampPercent (design-linear.md §6.1: Linear 0..1 progress -> an integer percent)', () => {
  it('rounds the fraction to a whole percent', () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(0.5)).toBe(50);
    expect(clampPercent(1)).toBe(100);
    expect(clampPercent(0.666)).toBe(67); // 66.6 -> 67
    expect(clampPercent(0.004)).toBe(0); // a tiny fraction still floors to 0%
  });

  it('clamps out-of-range and non-finite progress to [0, 100]', () => {
    expect(clampPercent(1.5)).toBe(100);
    expect(clampPercent(-0.2)).toBe(0);
    expect(clampPercent(NaN)).toBe(0);
    expect(clampPercent(Infinity)).toBe(0);
  });
});

describe('formatDue (design-linear.md §5.2: Today bone-bright, overdue amber, future muted — AOD-134 tone)', () => {
  const now = new Date(2026, 5, 29, 10, 0, 0); // Jun 29 2026, local

  it('returns null for a missing or unparseable due date (the row omits it)', () => {
    expect(formatDue(null, now)).toBeNull();
    expect(formatDue('not-a-date', now)).toBeNull();
  });

  it('labels today as "Today" on the today tone (bone-bright)', () => {
    expect(formatDue('2026-06-29', now)).toEqual({ label: 'Today', tone: 'today' });
  });

  it('flags an overdue date on the overdue tone (the amber breach ink), distinct from Today', () => {
    const due = formatDue('2026-06-25', now);
    expect(due?.tone).toBe('overdue'); // Soundings splits overdue from Today (was the single `emphasized`)
    expect(due?.label).toBeTruthy();
    expect(due?.label).not.toBe('Today');
  });

  it('keeps a future date on the future tone (muted)', () => {
    const due = formatDue('2026-07-02', now);
    expect(due?.tone).toBe('future');
    expect(due?.label).toBeTruthy();
  });
});

describe('endsInLabel (design-linear.md §6.2: the cycle "ends in N days" meta)', () => {
  const now = new Date(2026, 5, 29, 10, 0, 0); // Jun 29 2026, local
  // Build endsAt at local noon so the calendar-day diff is timezone-independent under jest (no midnight flip).
  const endsAt = (y: number, m: number, d: number) => new Date(y, m, d, 12, 0, 0).toISOString();

  it('counts whole days to the end, with today/tomorrow phrasings', () => {
    expect(endsInLabel(endsAt(2026, 6, 2), now)).toBe('ends in 3 days'); // Jun 29 -> Jul 2
    expect(endsInLabel(endsAt(2026, 5, 30), now)).toBe('ends tomorrow');
    expect(endsInLabel(endsAt(2026, 5, 29), now)).toBe('ends today');
  });

  it('returns null for an already-ended or unparseable cycle (defensive)', () => {
    expect(endsInLabel(endsAt(2026, 5, 28), now)).toBeNull(); // Jun 28, already past
    expect(endsInLabel('not-a-date', now)).toBeNull();
  });
});
