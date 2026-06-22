# Linear tooling (alwaysOnDashboard)

How and where to run Linear operations for the AOD team (key `AOD`, workspace `thexap`).

## Where the tool lives

The Linear migration tool is shared across Xavier's projects (it is team-agnostic; the team comes from each manifest). It is NOT vendored into this repo:

- Bulk writes: `/Users/xavierperez/tools/linear-migration/migrate.mjs`
- Reads / status: `/Users/xavierperez/tools/linear-helpers/*.mjs`

It authenticates with a single `thexap` Personal API key (in the shared tool's gitignored `.env`) that works for every team in the workspace, including AOD. The same key drives Armonia and Portfolio.

## MCP vs SDK: when to use which

- A few issue creates or edits: use the Linear MCP directly. Cheaper for small changes.
- Bulk writes (a restructure, a build-backlog seed, dependency wiring): use this SDK tool with a JSON manifest. About 85 percent less context than MCP at scale, and the manifest is the committed audit trail.

## Writing to AOD in bulk

1. Author a manifest under `tools/linear/manifests/` with `"team": "AOD"`.
2. Surface the manifest for approval before running (batch and review; see [`docs/engineering-process.md`](../../docs/engineering-process.md)).
3. Run it by absolute path (works from any CWD):

   ```bash
   node /Users/xavierperez/tools/linear-migration/migrate.mjs \
     tools/linear/manifests/<name>.json
   ```

4. The tool writes `<name>-output.json` next to the manifest (the Linear UUIDs it created). That output is gitignored; the manifest itself is committed as the audit trail.

Op vocabulary and caveats (create-issue is not idempotent; label and description updates replace rather than append): see `/Users/xavierperez/tools/linear-migration/README.md`.

## Reading AOD status

Always pass `LINEAR_TEAM_KEY=AOD` (the helpers default to ARM):

```bash
LINEAR_TEAM_KEY=AOD node /Users/xavierperez/tools/linear-helpers/project-milestones.mjs
LINEAR_TEAM_KEY=AOD node /Users/xavierperez/tools/linear-helpers/daily-summary.mjs
LINEAR_TEAM_KEY=AOD node /Users/xavierperez/tools/linear-helpers/blocked-issues.mjs
```

## Custom views

`create-views.mjs` holds per-team view-sets in a `VIEW_SETS` map. Add an `AOD` entry, then:

```bash
node /Users/xavierperez/tools/linear-migration/create-views.mjs --team AOD
```

## History

The tool used to live in the Armonia repo (`Armonia/tools/`). It was moved to the shared location on 2026-06-21 when AOD adopted it, reusing the same key. Armonia's manifests stayed in the Armonia repo as its audit trail.
