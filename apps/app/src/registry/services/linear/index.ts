// The Linear service: the client half of the registration (AOD-8 §5.1, §8; integration-linear.md §4, §8).
// The mirror of the server half in supabase/functions/_shared/{registry,operations,option-sources}.ts:
// same ids, same widget types, but the client half carries the visual surface (titles, sizes, the render
// component) and never a secret, a provider URL, or a GraphQL query (AOD-8 §4). Adding Linear is this one
// entry plus its leaf renderers plus one registration line in the client index; the layout engine, the
// widget host, the config form, and Settings are NOT edited (the §8 not-touched footprint).
import type { ServiceDefinition, WidgetDefinition } from '../../types';
import { MyIssuesCard } from './MyIssuesCard';
import { CurrentCycleCard } from './CurrentCycleCard';

// My Issues (the PS-M3 flagship). Sizes / cadence / TTLs are integration-linear.md §4.1, §7.2; the
// config schema is §5.1: projectId (remote-options, required, stable id stored) + filter (enum, offline).
const myIssues: WidgetDefinition = {
  type: 'my_issues',
  serviceId: 'linear',
  title: 'My Issues',
  supportedSizes: ['medium', 'large', 'tall'],
  defaultRefresh: { seconds: 300 }, // device asks every 5 min (AOD-10 §6.2)
  cacheTtlSeconds: 120, // provider hit at most once per 2 min across devices (AOD-10 §6.1)
  minRefreshSeconds: 60, // never poll Linear faster than once a minute
  dimsWithAmbient: true,
  configSchema: {
    fields: [
      {
        key: 'projectId',
        label: 'Project',
        kind: 'remote-options',
        required: true,
        source: { optionSource: 'linear_projects' },
      },
      {
        key: 'filter',
        label: 'Show',
        kind: 'enum',
        required: false,
        default: 'open',
        options: [
          { value: 'open', label: 'Open' },
          { value: 'in_progress', label: 'In progress' },
          { value: 'all', label: 'All assigned' },
        ],
      },
    ],
  },
  render: MyIssuesCard,
};

// Current Cycle (the fast-follow). Sizes / cadence / TTLs are §4.2, §7.2; config is §5.2: teamId
// (remote-options, required). The widget tracks the team's live active cycle, so the teamId is stored,
// not a pinned cycle id.
const currentCycle: WidgetDefinition = {
  type: 'current_cycle',
  serviceId: 'linear',
  title: 'Current Cycle',
  supportedSizes: ['medium', 'large'],
  defaultRefresh: { seconds: 600 }, // cycle data moves slowly; ask every 10 min
  cacheTtlSeconds: 300, // provider hit at most once per 5 min across devices
  minRefreshSeconds: 120,
  dimsWithAmbient: true,
  configSchema: {
    fields: [
      {
        key: 'teamId',
        label: 'Team',
        kind: 'remote-options',
        required: true,
        source: { optionSource: 'linear_teams' },
      },
    ],
  },
  render: CurrentCycleCard,
};

export const linearService: ServiceDefinition = {
  id: 'linear',
  displayName: 'Linear',
  icon: 'linear',
  authClass: 'oauth2',
  widgets: [myIssues, currentCycle],
};
