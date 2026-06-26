// The normalized Calendar payloads the renderers receive (integration-calendar.md §4), mirroring the
// server-side operations.ts output (CalendarEvent / NextEventData / AgendaData). This is the client
// data contract between the broker's normalize step and the two cards; the events.list query and the
// raw-response mapping stay server-side (§6.4), so the client re-declares only the shapes it renders,
// never the query or the {calendarId} path token.
export interface CalendarEvent {
  id: string;
  summary: string; // event title; "" when Google omits it (an untitled event)
  location: string | null;
  start: string; // ISO: the dateTime (timed) or the date "YYYY-MM-DD" (all-day)
  end: string;
  allDay: boolean; // true when Google used start.date (no dateTime)
  htmlLink: string;
}

/** `hasEvent: false` is a normal empty-window state (§4.1), not an error or needs-config. */
export type NextEventData = { hasEvent: false } | { hasEvent: true; event: CalendarEvent };

/** An empty `events` array is the normal "nothing left today" state (§4.2). */
export interface AgendaData {
  events: CalendarEvent[];
}
