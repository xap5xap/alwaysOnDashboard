// The normalized Claude usage payloads the renderers receive (integration-claude.md §4), mirroring the
// server-side operations.ts output (DailyCost / SpendMtdData / DailySpendData). This is the client data
// contract between the broker's normalize step and the two cards; the /v1/organizations/cost_report
// request (the MTD window) and the raw-response mapping (the cents -> dollars / 100 conversion) stay
// server-side (§6.4), so the client re-declares only the shapes it renders, never the query or the key.

/** One day's normalized spend (integration-claude.md §4.0a). The shared element both widgets read. */
export interface DailyCost {
  date: string; // "YYYY-MM-DD" (UTC; the API snaps buckets to UTC day starts)
  amount: number; // that day's total spend in MAJOR units (USD dollars), already / 100 server-side
}

/** Spend MTD (integration-claude.md §4.1): the month-to-date headline glance. */
export interface SpendMtdData {
  amount: number; // month-to-date total spend, major units (dollars)
  currency: string; // "USD" (echoed so the card formats without hard-coding $)
  windowStart: string; // the MTD window start, "YYYY-MM-DD" (1st of the current UTC month)
  asOf: string; // the last covered day, "YYYY-MM-DD" (today, UTC)
  daysElapsed: number; // daily buckets covered, so the card can derive a run-rate / projection
}

/** Daily Spend Sparkline (integration-claude.md §4.2): the daily series for the sparkline. */
export interface DailySpendData {
  days: DailyCost[]; // one entry per daily bucket, oldest-first (month-to-date)
  currency: string; // "USD"
  total: number; // sum of days[].amount; equals SpendMtdData.amount over the same window
}
