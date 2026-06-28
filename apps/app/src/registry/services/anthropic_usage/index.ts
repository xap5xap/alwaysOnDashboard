// The Claude usage service: the client half of the registration (AOD-8 §5.1, §8;
// integration-claude.md §4, §5, §8). The mirror of the server half in
// supabase/functions/_shared/{registry,operations}.ts: same id, same widget types, but the client half
// carries the visual surface (titles, sizes, the render component) and never a secret, a provider URL, a
// query, or the cents->dollars vocabulary (AOD-8 §4). Claude usage is the fourth real service, the first
// admin_key one, and zero-config: org-wide totals with NO user choice at all (§5.1), so both widgets
// declare an empty config schema and the host takes its unchanged else-branch (params = instance.config =
// empty, §6.3), no params-seeding. Adding it is this one entry plus its two leaf renderers plus one line
// in the client index; the layout engine, the widget host, the config form, and Settings are NOT edited.
import type { ServiceDefinition, WidgetDefinition } from '../../types';
import { SpendMtdCard } from './SpendMtdCard';
import { DailySpendCard } from './DailySpendCard';

// Spend MTD (the single glance). Sizes / cadence / TTLs are integration-claude.md §4.1, §7.2. Zero-config:
// org-wide totals, no per-instance or connection config (§5.1), so configSchema.fields is empty.
const spendMtd: WidgetDefinition = {
  type: 'spend_mtd',
  serviceId: 'anthropic_usage',
  title: 'Claude Spend (MTD)',
  supportedSizes: ['small', 'medium'],
  defaultRefresh: { seconds: 1800 }, // device asks every ~30 min; the figure is daily-granular and lags (§7)
  cacheTtlSeconds: 900, // provider hit at most once / 15 min; at the AOD-5 ceiling (§7)
  minRefreshSeconds: 900,
  dimsWithAmbient: true,
  configSchema: { fields: [] },
  render: SpendMtdCard,
};

// Daily Spend Sparkline (the daily series). Sizes / cadence / TTLs are §4.2, §7.2. A daily series barely
// moves intraday, so the device asks every ~60 min and is served from the <=900s cache.
const dailySpend: WidgetDefinition = {
  type: 'daily_spend',
  serviceId: 'anthropic_usage',
  title: 'Claude Daily Spend',
  supportedSizes: ['wide', 'large'],
  defaultRefresh: { seconds: 3600 }, // device asks every ~60 min; a daily series barely moves intraday (§7)
  cacheTtlSeconds: 900, // provider floor at the AOD-5 ceiling (§7)
  minRefreshSeconds: 900,
  dimsWithAmbient: true,
  configSchema: { fields: [] },
  render: DailySpendCard,
};

export const anthropicUsageService: ServiceDefinition = {
  id: 'anthropic_usage',
  displayName: 'Claude usage',
  icon: 'claude',
  authClass: 'admin_key',
  widgets: [spendMtd, dailySpend],
};
