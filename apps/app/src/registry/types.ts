// The client half of the service -> widget -> layout registry contract (AOD-8 §5-§8) with the
// AOD-10 §3 widget-model additions folded in. This is the mirror of the server half in
// supabase/functions/_shared/{types,registry}.ts: same ids, same auth-class taxonomy, but the client
// half carries the visual surface (titles, sizes, the render component) and never a secret or a
// provider URL (AOD-8 §4). The generic engine (registry lookups, the widget host, the dashboard)
// reads these types and is never edited to add a service.
import type { ComponentType } from 'react';
import type { FitBox } from '../widgets/fitLadder';

export type ServiceId = string;
export type WidgetTypeId = string;
// The AOD-9 / AOD-8 §5 auth-class taxonomy, shared with the server half.
export type AuthClass = 'oauth2' | 'api_key' | 'admin_key' | 'platform_key' | 'none';
export type IconRef = string;

// The S/M/W/L slot catalogue (AOD-122, Many Skies §1c): S 1x1 / M 1x2 / W 2x1 / L 2x2 on a
// two-column, 96px-row grid. Supersedes the AOD-10 §5.1 five-class set (small/medium/large/wide/tall);
// the retired legacy ids survive only in the DB column vocabulary (layout/schema.ts DbWidgetSize) and
// are coerced at the read boundary (layout/mapper.ts).
export type WidgetSize = 'S' | 'M' | 'W' | 'L';

// AOD-8 §6 refresh interval. Semantics (floors, effective interval) are AOD-10 §6.
export type RefreshInterval = { seconds: number } | 'manual';

// AOD-9 §5.1 connection status enum, mirrored for the host lifecycle mapping (AOD-10 §7.2).
export type ConnectionStatus = 'connected' | 'reauth_required' | 'error' | 'disconnected';

// --- config schema (AOD-8 §6 boundary, AOD-10 §4.1 interiors) -----------------------------------

export type Choice = { value: string; label: string };

/** How a remote-options field fetches its choices at config time through the proxy (AOD-10 §4.3). */
export interface RemoteOptionsSource {
  optionSource: string; // an allow-listed config-time query id, resolved server-side. Never a URL.
  params?: Record<string, unknown>;
}

// The AOD-8 base (key/label/kind/required) intersected with the AOD-10 §4.1 per-kind extras.
export type WidgetConfigField = { key: string; label: string; required: boolean } & (
  | {
      kind: 'string';
      default?: string;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      placeholder?: string;
      // Optional client SAVE-TIME validator beyond the static checks (integration-clock.md §5.2, the
      // Intl time-zone check). Returns an error message, or null when valid. Run by validateConfig only
      // under runFieldValidators (the config form's save path), NOT at the host's render-time check, so a
      // field whose value can degrade gracefully (e.g. a Clock IANA zone) never trips needs_config (§5.4,
      // §7.3). In-code only: the schema lives in the WidgetDefinition and is never serialized.
      validate?: (value: string) => string | null;
    }
  | { kind: 'number'; default?: number; min?: number; max?: number; step?: number }
  | { kind: 'boolean'; default?: boolean }
  | { kind: 'enum'; default?: string; options: Choice[] }
  | { kind: 'remote-options'; default?: string | string[]; source: RemoteOptionsSource; multiple?: boolean }
);

export type WidgetConfigFieldKind = WidgetConfigField['kind'];

export interface WidgetConfigSchema {
  fields: WidgetConfigField[];
}

// --- the widget (AOD-8 §6 WidgetDefinition + AOD-10 §3 WidgetModel additions) --------------------

/** AOD-8 §6.1 render contract: render is invoked only with live, normalized data. */
export interface WidgetRenderProps {
  data: unknown; // normalized payload from the proxy (per-widget shape is AOD-10/per-integration)
  config: Record<string, unknown>;
  size: WidgetSize;
  // AOD-123: the host-computed body box (DP), the slot minus header + padding. The shared FitBody fits
  // content to it (value held, detail truncate-then-drop) with NO onLayout on the always-on hot path.
  // Optional so a leaf that does not use FitBody, or a direct-render test, still type-checks; FitBody
  // falls back to deriving the box from `size` when it is absent.
  box?: FitBox;
}
export type WidgetRenderer = ComponentType<WidgetRenderProps>;

export interface WidgetDefinition {
  type: WidgetTypeId; // unique within its publishing service
  serviceId: ServiceId; // back-reference to the parent service
  title: string;
  supportedSizes: WidgetSize[];
  defaultRefresh: RefreshInterval;
  configSchema: WidgetConfigSchema;
  render: WidgetRenderer; // client half only; the server half has no renderer
  // AOD-10 §3 author-declared model detail (all optional, with documented defaults):
  cacheTtlSeconds?: number; // provider-facing floor (AOD-9 proxy cache); defaults from defaultRefresh
  minRefreshSeconds?: number; // device-cadence floor the author asserts; default 0
  dimsWithAmbient?: boolean; // default true: host applies the global dim overlay (AOD-10 §8)
  // AOD-37 §4.2: sizes at which the host suppresses the quiet header for a self-evident card (Clock
  // declares ['S']). A generic host capability, not a per-service branch; default = show.
  hideHeaderAtSizes?: WidgetSize[];
}

/** AOD-10 §3 names the AOD-8 widget + its additions WidgetModel; kept as an alias for traceability. */
export type WidgetModel = WidgetDefinition;

// --- the service (AOD-8 §5.1 client half) -------------------------------------------------------

export interface ServiceDefinition {
  id: ServiceId; // the registry key; joins to the server half on the same id
  displayName: string;
  icon: IconRef;
  authClass: AuthClass; // drives the Settings connect affordance and whether the host proxies
  widgets: WidgetDefinition[];
}

// --- instances and layout (AOD-8 §7-§8, AOD-10 §3 ConfiguredInstance) ---------------------------

export interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number; // stacking order for overlapping instances
}

export interface WidgetInstance {
  instanceId: string;
  serviceId: ServiceId;
  widgetType: WidgetTypeId;
  config: Record<string, unknown>;
  rect: LayoutRect;
  size: WidgetSize;
  refresh?: RefreshInterval; // AOD-10 §3 per-placement override of defaultRefresh
}

export interface DashboardLayout {
  id: string;
  userId: string;
  name: string;
  instances: WidgetInstance[];
}
