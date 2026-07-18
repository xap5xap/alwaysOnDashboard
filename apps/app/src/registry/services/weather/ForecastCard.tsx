// The "Forecast" leaf renderer — the RANGE face (AOD-133; design Weather Eye 1f "The week, receding from
// Today"; the Range take: "each day's high-low drawn as a span on the week's 8°-21°"). Reached only on
// data-bearing lifecycle states; the generic host draws every other state, including the host-drawn `empty`
// phase (isForecastEmpty, the AOD-125 seam — the leaf no longer self-draws a "No forecast"). Receives only
// { data, config, size, box }. The server zips the columnar daily arrays into ForecastDay rows; this card
// lays them out today-first, scoped to the widget size. The weekday label is computed against the DEVICE
// clock (the date strings are local).
//
// Range replaces the numeric hi-lo TEXT with a per-day hi-lo SPAN-BAR on the week's shared min-max scale
// (range.ts, a pure helper — the "is the scale math right" flag). Both sizes are the same row family: the
// low numeral flanks the bar's left, the high is bold on the right (the numerals STAY beside the bar — the
// accessibility floor, hue is never the only carrier), and the day glyph + weekday lead. L is the
// comfortable list under a "Week X-Y" header; W is the compact one (smaller glyph, denser rows, no header),
// both height-fit by fitCount so a short cell never clips. Forecast NEVER wears a pane (it reads many
// skies). Colour binds to ROLES: the span bar wears the DAY'S HI thermometer hue (tempColor, theme.temp) as
// a SOLID (no lo→hi gradient — banned); today is full-bright and thicker, later days step back to
// pastOpacity; precip is theme.ink.rain (blank, never "0%", when the payload precip is null); the glyphs
// are bone (colors.text), receding to textMuted on later days. So Monochrome collapses temp+rain to bone
// for free and the span is still read by SHAPE (§8 theme axis).
import React from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import type { WidgetRenderProps, WidgetSize } from '../../types';
import type { ForecastData, ForecastDay, WeatherCondition } from './types';
import { WeatherIcon } from './WeatherIcon';
import { fitCount } from '../../../widgets/fitLadder';
import { tempColor } from './transit';
import { weekScale, spanFraction, CENTERED_SHORT } from './range';

// The no-box fallback (a direct render / a test without a host box): how many days a glance shows per size.
// The real hot path derives the count from the body HEIGHT (fitCount) so it never clips; these are the
// defensive floor. Forecast ships at W/L; S/M are defensive.
const VISIBLE_BY_SIZE: Record<WidgetSize, number> = { S: 3, M: 5, W: 3, L: 7 };

// The row column widths (DP). weekday + glyph LEAD; lo / hi / precip are fixed so the bar AREA (flex) is a
// consistent width across rows and the shared scale reads. Numerals are compact (type.caption) — the Range
// packs many per card. Sized to hold the REAL content at both ends: a 2-digit temp + degree ("28°", a
// signed "-5°") for lo/hi and "100%" for precip — RNTL can't see numberOfLines clipping, so these widths
// are the guard (a clipped "1…" would hide the forecast high and fail the colour-law legibility floor). The
// bar is the flex remainder over the 2-unit body (~168dp); the kiosk wall auto-fits the whole card up, so a
// tight in-app bar reads large on-wall. Widening the numerals eats that budget, so at W (the compact,
// ~one-row-tall size) precip is DROPPED — the truncation ladder's first casualty — leaving the bar a fat,
// shape-first remainder; L keeps precip (it is the fuller list) and takes the narrower bar.
const WEEKDAY_W = 36;
const LO_W = 24; // holds a 2-digit temp + degree ("28°") and a signed "-5°"
const HI_W = 26; // the high is bold (a touch wider)
const PRECIP_W = 36; // must hold "100%" (the observed ~8px/char web caption + headroom)

const FALLBACK_CONDITION: WeatherCondition = { code: -1, label: 'Unknown', group: 'cloudy', isDay: true };

/** Defensive read: a partial payload renders as (host-drawn) empty, never a crash. */
function asForecast(data: unknown): ForecastData {
  const d = (data ?? {}) as Partial<ForecastData>;
  const days = Array.isArray(d.days) ? (d.days as ForecastDay[]) : [];
  return { days, units: { temperature: d.units?.temperature ?? '°' } };
}

/** AOD-125/AOD-133 emptiness predicate (WidgetDefinition.isEmpty): no forecast days → the host-drawn
 *  `empty` phase (the shared EmptyBody), never a leaf-drawn body. Pure: no React, no I/O. */
export function isForecastEmpty(data: unknown): boolean {
  return asForecast(data).days.length === 0;
}

/** Parse "YYYY-MM-DD" as a LOCAL date so the weekday label matches the device-local day. */
function parseLocalYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whether a "YYYY-MM-DD" is the current device-local day (Today gets the bright emphasis). */
function isToday(date: string, now: Date): boolean {
  const d = parseLocalYmd(date);
  return (
    !!d &&
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** "Today" for the current device-local day, else a short weekday ("Mon"). */
function dayLabel(date: string, now: Date): string {
  const d = parseLocalYmd(date);
  if (!d) return '';
  return isToday(date, now) ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' });
}

export function ForecastCard({ data, size, box }: WidgetRenderProps) {
  const { theme } = useUnistyles();
  const { days, units } = asForecast(data);
  // The Range packs many numerals, so it echoes just the DEGREE SIGN of the payload unit (v1 is metric —
  // operations.ts pins "°C"); the single-figure Current card echoes the full "°C", the compact Range does not.
  const unit = units.temperature ?? '°';
  const deg = unit.charAt(0) === '°' ? '°' : unit;
  const now = new Date();

  // How many day-rows fit, by the body HEIGHT (fitCount), so a short cell never overflows. L reserves the
  // "Week …" header row (leadHeight) and uses the comfortable row height; W drops the header and packs the
  // denser compact row. No "+N more" footer — a forecast simply shows as many days as fit.
  const gap = theme.spacing(0.5);
  const visibleCount = box
    ? size === 'L'
      ? fitCount(days.length, box.height, {
          rowHeight: theme.range.rowHeight,
          gap,
          leadHeight: (theme.type.caption.lineHeight ?? 16) + theme.spacing(1),
        })
      : fitCount(days.length, box.height, { rowHeight: theme.range.compactRowHeight, gap })
    : (VISIBLE_BY_SIZE[size] ?? 5);
  const visible = days.slice(0, visibleCount);

  // AOD-133/AOD-125: an empty forecast is the host-drawn `empty` phase (isForecastEmpty). The guard remains
  // for crash-safety across a host/leaf skew and draws nothing (the AgendaCard precedent).
  if (visible.length === 0) return null;

  // The week's shared scale over the VISIBLE days (range.ts). null (no finite temps) → every bar degrades
  // to the centred short mark and the header is omitted; never a ÷0 or NaN.
  const scale = weekScale(visible);
  const glyphPx = size === 'L' ? theme.range.glyph : theme.range.compactGlyph;

  return (
    <View style={styles.list} accessibilityRole="summary" testID="weather-forecast">
      {size === 'L' && scale ? (
        <Text style={styles.weekHeader} numberOfLines={1} testID="weather-forecast-week">
          Week {Math.round(scale.min)}
          {deg}–{Math.round(scale.max)}
          {deg}
        </Text>
      ) : null}
      {visible.map((day) => {
        const condition = day.condition ?? FALLBACK_CONDITION;
        const today = isToday(day.date, now);
        // The day's span on the shared scale (fractions); §4 the bar wears the HI's thermometer hue as a solid.
        const span = scale ? spanFraction(day.tempMin, day.tempMax, scale) : CENTERED_SHORT;
        const barColor = tempColor(day.tempMax, theme.temp); // bone under Monochrome (temp→bone), so the shape carries it
        const barW = Math.max(0, span.hi - span.lo);
        return (
          <View key={day.date} style={styles.row}>
            <Text style={[styles.weekday, today ? styles.prominent : styles.receded]} numberOfLines={1}>
              {dayLabel(day.date, now)}
            </Text>
            {/* the day glyph: bone, receding on later days (Forecast days always use the day form) */}
            <WeatherIcon
              group={condition.group}
              isDay
              size={glyphPx}
              color={today ? theme.colors.text : theme.colors.textMuted}
              surface={theme.colors.surface}
              strokeWidth={theme.weatherIcon.stroke}
            />
            {/* the low flanks the bar's left and RECEDES (the cool end) */}
            <Text style={styles.loNum} numberOfLines={1}>
              {Math.round(day.tempMin)}
              {deg}
            </Text>
            {/* the span bar on the shared scale: solid HI hue, today thicker + full-bright, later days recede */}
            <View style={[styles.barArea, { height: today ? theme.range.todayBarHeight : theme.range.barHeight }]}>
              <View
                testID="weather-forecast-bar"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${span.lo * 100}%`,
                  width: `${barW * 100}%`,
                  minWidth: theme.range.minBarWidth,
                  borderRadius: theme.range.capRadius,
                  backgroundColor: barColor,
                  opacity: today ? theme.range.todayOpacity : theme.range.pastOpacity,
                }}
              />
            </View>
            {/* the high is BOLD on the right (the numeral beside the temp hue) */}
            <Text style={[styles.hiNum, today ? styles.prominent : styles.receded]} numberOfLines={1}>
              {Math.round(day.tempMax)}
              {deg}
            </Text>
            {/* precip → the rain ink; a null precip stays BLANK (never "0%"), the column reserved so bars align.
                L ONLY: at the compact W precip is the truncation ladder's first casualty, dropped so the
                legible numerals don't starve the bar (the day / bar / temps never give way). */}
            {size === 'L' ? (
              <View style={styles.precipCol}>
                {day.precipProbabilityPct != null ? (
                  <Text style={[styles.precip, { color: theme.ink.rain }]} numberOfLines={1}>
                    {day.precipProbabilityPct}%
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { gap: theme.spacing(0.5) },
  // the shared-scale label (L only): a quiet right-aligned caption over the list
  weekHeader: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginBottom: theme.spacing(1),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(0.5) },
  // weekday: Today bright, later days recede (the relative-time emphasis)
  weekday: { width: WEEKDAY_W, flexShrink: 0, ...theme.type.caption, letterSpacing: 0 },
  // hi/lo numerals, tabular so the ° columns align; flexShrink 0 so they never squeeze below their width
  loNum: {
    width: LO_W,
    flexShrink: 0,
    textAlign: 'right',
    ...theme.type.caption,
    letterSpacing: 0,
    color: theme.colors.textMuted, // the low always recedes (the cool end)
    fontVariant: ['tabular-nums'],
  },
  hiNum: {
    width: HI_W,
    flexShrink: 0,
    textAlign: 'right',
    ...theme.type.caption,
    letterSpacing: 0,
    fontWeight: '700', // the high is the bold figure
    fontVariant: ['tabular-nums'],
  },
  // the flex bar track — the segment inside is positioned by the shared-scale fractions (drawn inline). The
  // bar takes the row remainder after the (legible) numerals; the min floor keeps it visible when the
  // remainder is tight (L, precip kept) and the wall auto-fit scales it up. flexShrink 0 on the numerals so
  // a tight row shrinks the BAR (which can spare it), never the numerals (which must never clip).
  barArea: { flex: 1, minWidth: 16, position: 'relative' },
  precipCol: { width: PRECIP_W, flexShrink: 0, alignItems: 'flex-end' },
  precip: { ...theme.type.caption, letterSpacing: 0, fontVariant: ['tabular-nums'] },
  // today full-bright + bold vs later days stepped back (weekday + hi share this; hi is already 700, so the
  // weight only lifts today's weekday — the PDF's bold Today lead)
  prominent: { color: theme.colors.text, fontWeight: '700' },
  receded: { color: theme.colors.textMuted },
}));
