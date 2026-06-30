# Design: Vela settings + connections surface

> Status: draft for review, 2026-06-30. Tracked by [AOD-28](https://linear.app/thexap/issue/AOD-28) (`type:design`, `area:app` + `area:onboarding`; milestone PS-M2 "App shell", project Platform & App Shell). The **second per-feature core-screen design**: the connections interior that fills the Settings shell. It follows the `type:design` deliverable convention in [`engineering-process.md`](../engineering-process.md): a `design-` doc under `docs/specs/` plus rendered SVG mockups in `docs/specs/assets/`, screen-scoped tokens **specified** (not written into [`unistyles.ts`](../../apps/app/unistyles.ts)), merged via PR.
>
> **It supersedes the issue's original "Produce (Figma)" wording.** AOD-28 was written before [AOD-37](https://linear.app/thexap/issue/AOD-37) set the repo's `type:design` convention (a `design-` doc + rendered SVGs in-repo, not a Figma file). This deliverable follows that established convention, the same medium supersession [AOD-37](https://linear.app/thexap/issue/AOD-37) / [AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-20](https://linear.app/thexap/issue/AOD-20) / [AOD-17](https://linear.app/thexap/issue/AOD-17) / [AOD-21](https://linear.app/thexap/issue/AOD-21) / [AOD-27](https://linear.app/thexap/issue/AOD-27) used. No scope change, only the medium.
>
> **It is an application of the [AOD-21](https://linear.app/thexap/issue/AOD-21) shell, not a redesign of it.** [`design-core-navigation.md`](design-core-navigation.md) ([AOD-21](https://linear.app/thexap/issue/AOD-21)) designed the shared navigation **shell** once and explicitly handed the connections **interior** here: §6 fixed the **settings-home shell** (the pushed header, the section structure, the nav rows to Themes / Kiosk / Account) and the **Account screen** (sign out, deletion, subscription), placed the **Connections section**, and deferred its interior here; §7 fixed the **presentation** of the in-screen sheet (scrim + `elevation.overlay` + grabber) and deferred the credential form's **interior** here. This design fills that section. It is the exact relationship [AOD-27](https://linear.app/thexap/issue/AOD-27) (the dashboard interior) has to the same shell, and the relationship the per-widget designs have to [`design-widget-system.md`](design-widget-system.md) ([AOD-37](https://linear.app/thexap/issue/AOD-37)).
>
> **What this fixes, and what it must not touch.** It fixes **visuals only**: the connected-services list, the per-row connection states by `authClass`, the connect / disconnect / reconnect affordances, and the connect / credential-entry path, each expressed as a composition of the [AOD-20](https://linear.app/thexap/issue/AOD-20) components and the coded tokens, laid out inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) shell. It does **not** edit [`unistyles.ts`](../../apps/app/unistyles.ts), does **not** write screen code, and does **not** re-open the IA ([AOD-17](https://linear.app/thexap/issue/AOD-17)), the tokens ([AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66)), the brand ([AOD-18](https://linear.app/thexap/issue/AOD-18)), the shell ([AOD-21](https://linear.app/thexap/issue/AOD-21)), or the components ([AOD-20](https://linear.app/thexap/issue/AOD-20)). The connections surface composes entirely from the existing tokens and component groups; where a value is needed it is a role reference, and section 9 records that no new token group is required.
>
> **It honors two ownership splits, it does not re-claim them.** The AOD-28 issue description names "account" and "the per-instance config forms", both already owned elsewhere. **(1)** [AOD-21](https://linear.app/thexap/issue/AOD-21) §6 owns the **settings-home shell and the Account screen**; this design fills only the **Connections section** inside that shell and never redraws the frame, the nav rows, or Account. **(2)** [AOD-27](https://linear.app/thexap/issue/AOD-27) §9 owns the **widget-instance config sheet** (the generic `ConfigForm` over a `WidgetConfigSchema`); this design owns the **service credential form** ([`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx)). Section 7 states both splits explicitly.
>
> **Design FOR what already exists.** The connections surface is **built in code**. The app already renders the list, the per-row affordances, and the connect / disconnect / reconnect actions, functionally but unpolished. This design **canonicalizes** what those surfaces do ([`ConnectionsList.tsx`](../../apps/app/src/connections/ConnectionsList.tsx), [`ConnectionRow.tsx`](../../apps/app/src/connections/ConnectionRow.tsx), [`affordance.ts`](../../apps/app/src/connections/affordance.ts), [`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx), [`useConnections.ts`](../../apps/app/src/connections/useConnections.ts), [`connectionsRepo.ts`](../../apps/app/src/connections/connectionsRepo.ts), [`registry.ts`](../../apps/app/src/registry/registry.ts)) and flags every extension **additively** (section 10), not a greenfield redraw.

## 1. Purpose and scope

[`app-ia.md`](app-ia.md) (the IA) fixed where the Settings home, Connections, and the connect / credential-entry surfaces live and how each is reached (surfaces 7, 8, 9). [`design-core-navigation.md`](design-core-navigation.md) (the shell) fixed the settings-home frame and the sheet presentation around them. This design lays out the **interior** of the Connections section: how the connectable services list, how each row reads in each connection state, and how a user connects, disconnects, and reconnects a service.

It is to the Settings shell what [AOD-27](https://linear.app/thexap/issue/AOD-27) is to the Dashboard shell: an **application** of a fixed shell, composing the [AOD-20](https://linear.app/thexap/issue/AOD-20) components, not an invention of new chrome.

It fixes exactly four things:

1. **The connections list** (section 3): the connected-services list inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) §6 Connections section, one row per `connectableServices()` overlaid with its live status, plus the list-level loading and error states.
2. **The per-row states and the affordance matrix** (section 4): how a row reads in each `(authClass, status)` cell, the connect / disconnect / reconnect affordances `rowAction` derives, and the transient pending / inline-error states.
3. **The connect paths by `authClass`** (section 5): the `oauth2` system-browser round-trip to `vela://oauth/done`, the `api_key` / `admin_key` / `platform_key` credential-sheet path, and the `none` (Clock) no-connect case.
4. **The credential-entry sheet interior** (section 6): the API-key field (`admin_key` / `api_key`) and the location search (`platform_key`), inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet presentation.

Plus the cross-cutting handoffs: the ownership splits with [AOD-21](https://linear.app/thexap/issue/AOD-21) and [AOD-27](https://linear.app/thexap/issue/AOD-27) (section 7), the Gate / paywall entry (section 8), the token note (section 9), the reconciliation with the shipped surfaces (section 10), and the seams to the build and the sibling designs (section 11).

**In scope:** the Connections interior (the four areas above), each as a visual + interaction contract expressed as a composition of the [AOD-20](https://linear.app/thexap/issue/AOD-20) components and the coded tokens, laid out inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) shell, plus the additions handed to the build (sections 9, 10).

**Out of scope (named so the frame is clear):**

- **The nav shell / global chrome, the settings-home shell, and the Account screen** ([AOD-21](https://linear.app/thexap/issue/AOD-21), Done): the pushed header, the section structure, the Themes / Kiosk / Account nav rows, the Account surface (sign out, deletion, subscription), and the [AOD-21](https://linear.app/thexap/issue/AOD-21) §8 screen-level state visuals. This design lays out **inside** the Connections section; it does not redraw the frame (section 7).
- **The widget card visual system + lifecycle** ([AOD-37](https://linear.app/thexap/issue/AOD-37), Done): the host's `disconnected` and `needs_config` card prompts that the connection state mirrors are reused, not restyled (section 4).
- **The component library** ([AOD-20](https://linear.app/thexap/issue/AOD-20), Done): the list rows, inputs, search row, buttons, sheets, badges, and the lock / PRO overlay are **composed**, not redesigned.
- **The dashboard interior, including the per-instance widget config sheet** ([AOD-27](https://linear.app/thexap/issue/AOD-27), Done): this design owns the service **credential** form; AOD-27 owns the widget-**instance** config sheet (the overlap is resolved in section 7).
- **The Themes picker interior** ([`app-ia.md`](app-ia.md) §5 row 10 nominally assigns it here): AOD-28's Must-cover is connections-centric and does not name it, so it is **flagged, not designed** (section 11).
- **Onboarding and the full paywall layout** ([AOD-29](https://linear.app/thexap/issue/AOD-29)); the **OAuth broker internals and token model** ([AOD-9](https://linear.app/thexap/issue/AOD-9)) beyond placing the connect handoff; the **entitlement math** ([AOD-12](https://linear.app/thexap/issue/AOD-12)) beyond placing the Gate / paywall entry.
- **Re-deciding** the IA ([AOD-17](https://linear.app/thexap/issue/AOD-17)), the tokens ([AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66)), the brand ([AOD-18](https://linear.app/thexap/issue/AOD-18)), or the shell ([AOD-21](https://linear.app/thexap/issue/AOD-21)).
- **Writing screen code**: a future `type:tech-task` polishes the shipped surfaces to this design.

## 2. Locked context this builds on

| Source | What it locks | How this design uses it |
|---|---|---|
| [`design-core-navigation.md`](design-core-navigation.md) ([AOD-21](https://linear.app/thexap/issue/AOD-21)) | The **settings-home shell** (§6: the pushed header, the section structure, the nav rows, the Connections section placement) and the **Account screen**; the §7 in-screen sheet presentation (scrim + `elevation.overlay` + grabber); the §8 screen-level states. | This design fills the Connections **section** §6 placed and reuses the §7 sheet chrome verbatim for the credential form. No new chrome; the shell and Account are not redrawn (section 7). |
| [`app-ia.md`](app-ia.md) ([AOD-17](https://linear.app/thexap/issue/AOD-17)) | The **surfaces** and their presentation: Settings home (§5 row 7), Connections (row 8, a section of Settings), Connect / credential entry (row 9, sheet for key/location, system browser for OAuth); the §4.4 presentation rule; the §8 `vela://oauth/done` deep-link; the §7 connect-service entry. | Sections 3 to 6 lay out exactly those surfaces, with the presentation the IA fixes. The credential entry is the §4.4 / §5 row 9 in-screen sheet; the OAuth handoff is the §8 deep-link. No new surface. |
| [`design-component-library.md`](design-component-library.md) ([AOD-20](https://linear.app/thexap/issue/AOD-20)) | The list row + row-group (§8), inputs + the search-row variant (§6), buttons incl `destructive` (§5), sheets / modals (§9), badges (§10), the lock / PRO overlay (§11), all theming against the coded roles. | The connections rows, the connect affordances, the credential sheet, and the connect-limit lock **compose** these. Not redesigned. |
| [`design-widget-system.md`](design-widget-system.md) ([AOD-37](https://linear.app/thexap/issue/AOD-37)) | The host's `disconnected` prompt ("Connect &lt;Service&gt;") and `needs_config` prompt (§5), and the status dot (§3.1). | The connection row is the **settings-side home** of the card's `disconnected` prompt; the warning dot marks a `reauth_required` row. The card states are reused, not redrawn (section 4). |
| [`oauth-token-model.md`](oauth-token-model.md) ([AOD-9](https://linear.app/thexap/issue/AOD-9)) | The five **credential classes** (`oauth2` / `api_key` / `admin_key` / `platform_key` / `none`), the connect flows per class (§7), and the `disconnect` flow (§10); the `vela://oauth/done` callback ([`app-ia.md`](app-ia.md) §8). | Section 5 places the per-class connect path; section 4 derives the row affordance from the class. The broker internals (exchange, refresh, Vault) stay AOD-9's; this places the handoff only. |
| [`unistyles.ts`](../../apps/app/unistyles.ts) ([AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66)) | The **coded tokens**: the semantic `colors.*` roles, the `elevation` ladder, `scrim` / `onAccent` / `focusRing`, `radius.full`, the `dot` size, and the `type` / `spacing` scales. | Every value is a role reference; section 9 records that the surface adds **no new token group** (it composes [AOD-20](https://linear.app/thexap/issue/AOD-20) + [AOD-21](https://linear.app/thexap/issue/AOD-21) groups). |
| [`design-brand.md`](design-brand.md) ([AOD-18](https://linear.app/thexap/issue/AOD-18)) | The **one-accent rule**, the dark-first ambient surface, the calm voice. | One accent per surface (connect / reconnect are the accent; disconnect is the reserved `error`); copy follows the calm voice ("Connect Linear."). |
| [`apps/app/src/entitlements/Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx) ([AOD-12](https://linear.app/thexap/issue/AOD-12)) | The **UX-only gate**: `children` when entitled, `fallback` otherwise; the server still refuses an over-limit request. | The connect-limit lock (section 8) **is** the `Gate` fallback (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §11 lock row), routing to the paywall, never an enabled-but-trapped Connect. |
| The shipped connections code ([`ConnectionsList.tsx`](../../apps/app/src/connections/ConnectionsList.tsx), [`ConnectionRow.tsx`](../../apps/app/src/connections/ConnectionRow.tsx), [`affordance.ts`](../../apps/app/src/connections/affordance.ts), [`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx), [`useConnections.ts`](../../apps/app/src/connections/useConnections.ts), [`registry.ts`](../../apps/app/src/registry/registry.ts)) | The **functional-but-unpolished** connections surface and the registry seam ([AOD-8](https://linear.app/thexap/issue/AOD-8) §10). | This design **canonicalizes** what they do (section 10) and designs for them; it flags every extension additively, not a greenfield redraw. |
| [`engineering-process.md`](../engineering-process.md) | The `type:design` deliverable convention and the chain decision -> spec -> design -> tech-task. | This deliverable follows it; sections 9 to 11 hand the build to a `type:tech-task`. |

What is already true, and what this adds: the app already **renders** the connections list, connects and disconnects services, and prompts a reconnect, themed against the Unistyles theme. This design does not invent those surfaces. It **names the interior contract** they share, canonicalizes the drift the unpolished surfaces carry (the inline credential form, the `background` field fill, the hardcoded placeholder hex, the ad-hoc trailing actions), and writes the connections interior down once as the contract the build and the onboarding design reference.

## 3. The connections list (the filled section)

The Connections list is the secondary-hub's first section ([`app-ia.md`](app-ia.md) §5 rows 7, 8): the surface where a user wires up the services their widgets read. The frame is the [AOD-21](https://linear.app/thexap/issue/AOD-21) §6 settings-home shell (the pushed header over the row-group sections); the **interior** of the Connections section is the list this design fills, generic over the registry.

![The Vela connections list: a device frame showing the Settings pushed header tagged as the AOD-21 shell over the Connections row-group this design fills, with one row per connectable service: Linear and Google Calendar connected over OAuth with Disconnect, Weather connected over a platform location with Disconnect, Claude usage with a warning dot and Reconnect needed offering Reconnect, and Clock built in with a muted no-connection-needed label; a tag marks the Themes, Kiosk, and Account rows below as the AOD-21 shell; beside it the row anatomy, the authClass to affordance legend, the list-level loading and error states, and a token block.](assets/design-settings-connections-list.svg)

<details>
<summary>The list, the row anatomy &amp; the list states</summary>

```
frame    : AOD-21 §6 settings-home shell. The pushed header + the row-group sections. NOT redrawn here.
section  : the Connections row-group (AOD-20 §8): surface + border + radius.md · a type.caption "CONNECTIONS" heading.
source   : registry.connectableServices() · one ConnectionRow per entry, overlaid with its live ConnectionView (useConnections).
row      : the AOD-20 §8 list row · identity = displayName (type.title) + status line (type.meta/textMuted) · trailing = the affordance.
status   : statusLabel(status) · "Connected · <accountLabel>" / "Not connected" / "Reconnect needed" / "Error" / "Built in".
states   : loading -> "Checking…" per row · list error -> "Could not load your connections." (the shipped ConnectionsList copy).
seam     : the AOD-8 §10 registry seam -- the list names no service; + an integration = +1 row, zero edits here.
```
</details>

- **The section is the [AOD-20](https://linear.app/thexap/issue/AOD-20) §8 row-group.** A `surface` + `border` panel at `radius.md`, with a `type.caption` "CONNECTIONS" heading, sitting where the [AOD-21](https://linear.app/thexap/issue/AOD-21) §6 shell placed it. The shell owns the frame; this design draws the section's rows.
- **One row per `connectableServices()`.** The list renders [`registry.connectableServices()`](../../apps/app/src/registry/registry.ts) and overlays each entry with its live `ConnectionView` from [`useConnections`](../../apps/app/src/connections/useConnections.ts) (a `Map` keyed by service id; an absent key reads as "Not connected"). It names no service: adding an integration grows the list by one row with zero edits, the canonical [AOD-8](https://linear.app/thexap/issue/AOD-8) §10 invariant, preserved in the design.
- **Each row is the [AOD-20](https://linear.app/thexap/issue/AOD-20) §8 list row.** The identity pairs the `displayName` (`type.title`) with a status line (`type.meta` / `textMuted`); the trailing slot carries the affordance (section 4). A `reauth_required` row leads with the warning status dot (`dot`, the [AOD-37](https://linear.app/thexap/issue/AOD-37) §3.1 mark), the one place a status hue enters the list.
- **The list has its own loading and error.** While the connections resolve, each row reads "Checking…"; if the read fails, the section shows "Could not load your connections." ([`ConnectionsList.tsx`](../../apps/app/src/connections/ConnectionsList.tsx)). These are the **section's** states, distinct from a row's connection status and from the [AOD-21](https://linear.app/thexap/issue/AOD-21) §8 whole-screen states.

## 4. The per-row states and the affordance matrix

One generic row reads differently in each connection state, and the trailing affordance is derived, never branched per service. [`affordance.ts`](../../apps/app/src/connections/affordance.ts) is the one place that maps `(authClass, status)` to the row's action (`rowAction`); this section fixes how each cell of that matrix looks, plus the transient pending and inline-error states the awaited Edge Function calls produce.

![The Vela connection row state matrix: a left panel of not-connected rows keyed by authClass, oauth2 Linear offering Connect, admin_key Claude usage offering Add key, platform_key Weather offering Set location, and none Clock showing a muted no-connection-needed label; a right panel of live states keyed by status, connected Google Calendar offering a destructive Disconnect, reauth_required Claude usage with a warning dot offering Reconnect, error Weather with a warning dot offering Reconnect, and a pending row showing an ellipsis; below, a per-row error callout with an inline message and a connect-gate callout where a third service on Free turns Connect into a padlock with a PRO badge and a chevron to the paywall; a token block names the affordance source.](assets/design-settings-row-states.svg)

<details>
<summary>The affordance matrix, the transient states &amp; the affordance source</summary>

```
affordance = rowAction(authClass, status)  (affordance.ts -- the ONE map, never a per-service branch):
  status connected           -> { disconnect, "Disconnect" }              trailing = AOD-20 §5 destructive (error)
  status reauth_required/error-> { reconnect, "Reconnect" }               trailing = AOD-20 §5 ghost (accent) + warning dot
  status undefined/disconnected-> { connect, connectLabel(mechanism) }    trailing = AOD-20 §5 ghost (accent)
  authClass none             -> { none }                                  trailing = "No connection needed" (type.meta/textMuted)
connectLabel(mechanism): oauth -> "Connect" · key -> "Add key" · location -> "Set location"
transient (ConnectionRow per-row state, wraps each awaited Edge Function call):
  pending  -> the action reads "…"; the row is non-interactive until it resolves.
  error    -> messageOf(err) renders inline below the row (type.meta / error); clears on the next attempt.
gate     : a 3rd service on Free -> Connect becomes the AOD-20 §11 lock row -> Paywall (trigger=services). Section 8.
```
</details>

- **The affordance is `rowAction(authClass, status)`.** `connected` -> a `Disconnect` (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §5 **destructive** button, `error`-colored); `reauth_required` or `error` -> a `Reconnect` (the §5 **ghost** button, `accent`); no row or the transient `disconnected` -> a `Connect` whose label is `connectLabel(mechanism)` ("Connect" / "Add key" / "Set location"); `authClass: 'none'` (Clock) -> no action, a muted "No connection needed" label. The row never branches on which service; the class and the status carry it.
- **The reconnect path re-runs the connect mechanism.** A `reauth_required` / `error` row offers `Reconnect`, which re-runs the same class mechanism the connect used ([AOD-9](https://linear.app/thexap/issue/AOD-9) §9): an OAuth service re-opens the browser, a key / location service re-opens the credential sheet. The warning dot ([AOD-37](https://linear.app/thexap/issue/AOD-37) §3.1) marks the row, the same status mark the card's `stale` state uses, so the settings surface and the card speak the same status vocabulary.
- **The connection row is the settings-side home of the card prompt.** When a credential dies, the widget host shows the [AOD-37](https://linear.app/thexap/issue/AOD-37) §5 `disconnected` prompt ("Connect &lt;Service&gt;") on the card; that prompt routes the user here, where the row's `Reconnect` / `Connect` lives. The card states are [AOD-37](https://linear.app/thexap/issue/AOD-37)'s and are not redrawn; this design fixes the surface the card points at.
- **The transient states wrap each awaited call.** Each connect / disconnect / reconnect is an awaited Edge Function call ([`ConnectionRow.tsx`](../../apps/app/src/connections/ConnectionRow.tsx)); while it is in flight the action reads "…" and the row is non-interactive, and on failure `messageOf(err)` renders inline below the row (`type.meta` / `error`) and clears on the next attempt. These are per-row, not whole-section, states.
- **Disconnect is immediate today; a confirm is a flagged additive.** The shipped row disconnects on tap with no confirmation. Because disconnect purges the credential ([AOD-9](https://linear.app/thexap/issue/AOD-9) §10, hard-delete default), a destructive-confirm dialog (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §9 center modal) is a reasonable extension; it is **flagged additively** (section 10), not silently added.

## 5. The connect paths by authClass

How a row connects is decided by one function, `connectMechanism(authClass)` ([`affordance.ts`](../../apps/app/src/connections/affordance.ts)): `oauth2` opens a system browser, `api_key` / `admin_key` / `platform_key` open the credential sheet (section 6), and `none` connects to nothing. This section fixes that branch and draws the `oauth2` round-trip, the one path that leaves the app, at settings scale.

![The Vela connect paths: three branch chips for connectMechanism, oauth2 opening a system browser, key or location opening the credential sheet, and none meaning no connect; below, the oauth2 round-trip drawn as four nodes, the Connections row where Connect is tapped, the external system browser where scopes are approved via openAuthSessionAsync, the return to Vela at vela://oauth/done carrying service and status, and the row flipping to Connected after a re-fetch under row-level security; a banner states no token reaches the device because the code is exchanged server-side; a row notes the key and location paths post to credentials-store with no browser.](assets/design-settings-connect-paths.svg)

<details>
<summary>The branch, the OAuth round-trip &amp; the no-browser paths</summary>

```
branch = connectMechanism(authClass):
  oauth2                       -> system browser  (Linear, Google Calendar)
  api_key · admin_key · platform_key -> the credential sheet (§6)  (Claude usage, Weather)
  none                         -> no connect  (Clock)
oauth2 round-trip (app-ia §8 / AOD-9 §7.1, at settings scale):
  1 in app   : the Connections row, tap "Connect" -> openAuthSessionAsync(authorizeUrl, 'vela://oauth/done')
  2 external : the system browser, approve scopes at the provider
  3 back     : the backend 302s to vela://oauth/done?service&status (a success signal only, NEVER a token)
  4 resolved : the app re-fetches its RLS-scoped connections -> the row flips to Connected
no token reaches the device: the backend exchanges the code server-side and stores it in Vault (AOD-9 §7.1).
key/location: no browser. POST credentials-store -> Vault (key) or connection config (location), AOD-9 §7.2.
```
</details>

- **The branch is `connectMechanism(authClass)`.** OAuth services open the system browser; key and location services open the credential sheet; Clock connects to nothing. The branch is the class's, never the service's, which is why a future paste-your-key or location integration inherits the right path by registration alone.
- **The `oauth2` round-trip leaves and returns the app.** Tapping `Connect` opens the provider authorize URL in a system browser session (`openAuthSessionAsync(authorizeUrl, 'vela://oauth/done')`, [`app-ia.md`](app-ia.md) §8.1). The user approves scopes at the provider; the backend `oauth-callback` exchanges the code server-side and 302-redirects to `vela://oauth/done?service=…&status=…`; the in-app session resolves, the app reads `{ service, status }`, closes the browser, and re-fetches its connections. The row flips to Connected.
- **No token reaches the device.** The redirect carries a success signal only; the authorization code is delivered to the backend over TLS and exchanged server-side, and the tokens live in Vault ([AOD-9](https://linear.app/thexap/issue/AOD-9) §7.1). This design **places the handoff**; the exchange, refresh, and storage are [AOD-9](https://linear.app/thexap/issue/AOD-9)'s.
- **Key and location skip the browser.** `admin_key` / `api_key` collect a key and `platform_key` collects a location; both POST once to `credentials-store` over TLS ([AOD-9](https://linear.app/thexap/issue/AOD-9) §7.2). The key is stored in Vault; the location is stored as the connection's non-secret config (no Vault secret, no per-user credential). Their interior is section 6.
- **The scheme is `vela://oauth/done`.** The canonical callback is the `vela` scheme ([`app-ia.md`](app-ia.md) §8.1), which supersedes [AOD-9](https://linear.app/thexap/issue/AOD-9) §7.1's pre-rename `alwaysondashboard://` example. This design uses the canonical scheme; it does not re-decide it.

## 6. The credential-entry sheet interior

The non-OAuth connect collects a key or a location in an in-screen sheet ([`app-ia.md`](app-ia.md) §4.4, §5 row 9): it carries a live `ServiceDefinition` + `authClass`, so it stays off the router. [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 fixed its **presentation** (scrim + `elevation.overlay` + grabber); this section fixes its **interior**, the generic [`CredentialForm`](../../apps/app/src/connections/CredentialForm.tsx) that dispatches on the mechanism, never the service.

![The Vela credential-entry sheet: two device frames, each showing the Connections list dimmed under a scrim with a bottom sheet rising at the overlay elevation with a grabber; the left key variant for admin_key and api_key, titled Connect Claude usage, with an API KEY label, a masked secret field with a Paste your key placeholder, and Cancel and Save actions, plus a note that the key is never logged or returned and shows a masked hint after connect; the right location variant for platform_key, titled Connect Weather, with a LOCATION label, a search row pairing a city field with a Search button, a results list of two geocoded cities, and a Cancel action, plus a note that picking a result submits coordinates; a footer states the presentation is the AOD-21 sheet chrome.](assets/design-settings-credential-sheet.svg)

<details>
<summary>The two interiors, the field kinds &amp; the AOD-21 §7 chrome</summary>

```
presentation : AOD-21 §7 in-screen sheet (scrim + sheet at elevation.overlay + grabber). Carries a live ServiceDefinition.
dispatch     : CredentialForm switches on the MECHANISM ('key' | 'location'), never the service (AOD-8 §10).
key  (admin_key / api_key):
  one secret field (AOD-20 §6 input · surfaceAlt fill · border · placeholder -> textMuted) · secureTextEntry · submit { apiKey }.
  Cancel (AOD-20 §5 ghost / textMuted) + Save (AOD-20 §5 primary · onAccent). admin_key: never logged/returned, masked hint after (AOD-9 §4).
location (platform_key, Weather):
  the AOD-20 §6 SEARCH ROW: a city field + a primary "Search" -> keyless geocoding; results = AOD-20 §8 list rows.
  pick a result -> submits { latitude, longitude, timezone, name } (integration-weather §5.2). sub-states: searching… · no matches · error.
  no per-user secret: the location is stored as connection config (AOD-9 §7.2). Cancel only (the pick is the submit).
```
</details>

- **Reuses the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet.** The scrim darkens the Connections list, the sheet rises at `elevation.overlay` (`surfaceAlt`) with a grabber, and a header pairs the "Connect &lt;Service&gt;" title with a Close. This design draws only the **interior**; the presentation is the shell's.
- **The interior dispatches on the mechanism.** [`CredentialForm`](../../apps/app/src/connections/CredentialForm.tsx) renders the `key` interior for `admin_key` / `api_key` and the `location` interior for `platform_key`, switching on the mechanism and never the service, so a future integration in either class reuses it as-is.
- **The key interior is one secret field.** An [AOD-20](https://linear.app/thexap/issue/AOD-20) §6 input (`surfaceAlt` fill, `border`, placeholder -> `textMuted`) with `secureTextEntry`, an "API KEY" label, and a Cancel (ghost) + Save (primary, `onAccent`) action row. It submits `{ apiKey }`. An `admin_key` is high-sensitivity ([AOD-9](https://linear.app/thexap/issue/AOD-9) §4): it is never logged or returned, and Settings shows only a masked hint after connect, so the field serves both `api_key` and `admin_key` with the same interior.
- **The location interior is the search row.** The [AOD-20](https://linear.app/thexap/issue/AOD-20) §6 **search-row variant**: a city field beside a primary "Search" that queries a keyless geocoding API, with the results as [AOD-20](https://linear.app/thexap/issue/AOD-20) §8 list rows. Picking a result is the submit (it sends `{ latitude, longitude, timezone, name }`, [`integration-weather.md`](integration-weather.md) §5.2), so the only button is Cancel. Its sub-states are quiet: a "searching…" hint, a "No matches. Try a different city." empty, and a search error, each kept separate from the connect mutation so a failed search never blocks Cancel.
- **The location stores no secret.** A `platform_key` connect writes the chosen location as the connection's non-secret config and no Vault secret ([AOD-9](https://linear.app/thexap/issue/AOD-9) §7.2); Settings shows the location and a connected status, with no masked-key hint because there is no per-user key.

## 7. The ownership splits (named, not silent)

The AOD-28 issue description names "account" and "the per-instance config forms", both already owned elsewhere. This design honors both splits explicitly rather than re-claiming them, the same way [AOD-27](https://linear.app/thexap/issue/AOD-27) §9 resolved its overlap.

- **Settings shell and Account are [AOD-21](https://linear.app/thexap/issue/AOD-21)'s; the Connections section is this design's.** [`app-ia.md`](app-ia.md) §5 lists the Settings home (row 7) and Account (row 11) design owner as [AOD-28](https://linear.app/thexap/issue/AOD-28), but the [AOD-21](https://linear.app/thexap/issue/AOD-21) §6 goal already laid out the **settings-home shell** (the pushed header, the section structure, the nav rows routing to Themes / Kiosk / Account) and the **Account screen** (the identity block, sign out relocated here, deletion, the manage-subscription link). They reconcile as the keystone-and-application split [AOD-21](https://linear.app/thexap/issue/AOD-21) §6 already fixed: **AOD-21 owns the shell and Account; AOD-28 fills the Connections section interior** (sections 3 to 6). This design does not redraw the frame, the nav rows, or Account; the mockups tag them "shell = AOD-21".
- **The widget-instance config sheet is [AOD-27](https://linear.app/thexap/issue/AOD-27)'s; the service credential form is this design's.** The AOD-28 description mentions "the per-instance config forms", but [`app-ia.md`](app-ia.md) §5 row 5 and [AOD-27](https://linear.app/thexap/issue/AOD-27) §9 already assign the **widget-instance config sheet** (the generic `ConfigForm` over a `WidgetConfigSchema`, [`ConfigForm.tsx`](../../apps/app/src/widgets/ConfigForm.tsx), carrying a live `WidgetInstance`) to AOD-27. This design owns the **service credential form** ([`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx), carrying a live `ServiceDefinition`, section 6). Both are in-screen sheets reusing the same [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 chrome; they differ in **interior** and in **what they parameterize** (a widget instance vs a service). The split is clean: the dashboard configures widgets ([AOD-27](https://linear.app/thexap/issue/AOD-27)); Settings connects services (here). Neither redraws the other's sheet.

## 8. The Gate / paywall entry (the connect limit)

The Free plan caps connected services ([AOD-12](https://linear.app/thexap/issue/AOD-12) §7.1, `maxConnectedServices`). This design **places** that gate on the connect affordance; the tier math is [AOD-12](https://linear.app/thexap/issue/AOD-12)'s and the paywall body is [AOD-29](https://linear.app/thexap/issue/AOD-29)'s.

- **Connecting past the limit is the `Gate` fallback.** When a Free user has reached the connected-service cap, the `Connect` on the next service is the [AOD-20](https://linear.app/thexap/issue/AOD-20) §11 **lock row** (a padlock glyph, a `textMuted` title, a PRO `accentMuted` badge, a chevron) routing to the Paywall with `trigger=services` ([`app-ia.md`](app-ia.md) §7). It is the `Gate` fallback ([`Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx)): UX-only, never an enabled-but-trapped Connect; the server refuses an over-limit `credentials-store` / `oauth-start` regardless of what the UI shows.
- **It reuses the lock vocabulary already in the shell.** This is the same lock affordance the Settings Themes / Kiosk rows use ([AOD-21](https://linear.app/thexap/issue/AOD-21) §6) and the dashboards-switcher create gate uses ([AOD-27](https://linear.app/thexap/issue/AOD-27) §8), so the freemium gate reads consistently wherever it appears. The math (which service is the Nth, when the cap applies) and the paywall layout are not this design's.

## 9. Connections-scoped token note (the AOD-21 §11 / AOD-20 §12 analog)

The connections interior composes **entirely** from the existing tokens and the [AOD-20](https://linear.app/thexap/issue/AOD-20) / [AOD-21](https://linear.app/thexap/issue/AOD-21) component groups. Unlike [AOD-27](https://linear.app/thexap/issue/AOD-27) (`arrange`) or [AOD-21](https://linear.app/thexap/issue/AOD-21) (`appBar` / `screen`), it needs **no new token group**; this section records that and names what it reuses, so the build adds nothing to [`unistyles.ts`](../../apps/app/unistyles.ts) for this surface.

| # | Element | Kind | What it composes |
|---|---|---|---|
| 1 | The connections section + rows | **Composes, no new token.** | The [AOD-20](https://linear.app/thexap/issue/AOD-20) §8 `rowGroup` + `listRow` (`divider -> border`, row padding on the spacing rungs). |
| 2 | The connect / reconnect / disconnect actions | **Composes, no new token.** | The [AOD-20](https://linear.app/thexap/issue/AOD-20) §5 `button` variants: `ghost` (Connect / Reconnect, `accent`), `destructive` (Disconnect, `error`), with `pressedTint -> accentMuted`. |
| 3 | The reauth status dot | **Composes, no new token.** | The shipped `dot` token (r 4.5) filled `warning`, the [AOD-37](https://linear.app/thexap/issue/AOD-37) §3.1 status mark. |
| 4 | The credential sheet + its fields | **Composes, no new token.** | The [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 `sheet` chrome (`scrim` + `elevation.overlay` + grabber) + the [AOD-20](https://linear.app/thexap/issue/AOD-20) §6 `input` + the §6 search row + the §8 result rows. |
| 5 | The connect-limit lock + PRO badge | **Composes, no new token.** | The [AOD-20](https://linear.app/thexap/issue/AOD-20) §11 `lockRow` + the PRO `accentMuted` badge (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §3.3 semantic role, added by the DS-M2 build, not here). |

The one role this surface leans on that is **specified but not yet coded** is `accentMuted` (the PRO badge fill), added to [`unistyles.ts`](../../apps/app/unistyles.ts) by the [AOD-20](https://linear.app/thexap/issue/AOD-20) component build, not by this design, exactly as [AOD-27](https://linear.app/thexap/issue/AOD-27) and [AOD-21](https://linear.app/thexap/issue/AOD-21) referenced it. No `type.*` is touched, so there is no deep-style typing concern (the `aod-unistyles-style-token-gotcha` note).

## 10. Reconciliation with the shipped surfaces (the AOD-21 §12 / AOD-20 §13 analog)

The connections interior is a **canonicalization** of the shipped surfaces, not a greenfield redraw. Each drift the unpolished surfaces carry is listed here for the implementing `type:tech-task`. None changes a token **value**; they align the call sites to the shell, the components, and the IA presentation rule. Several deltas are the same ones [AOD-20](https://linear.app/thexap/issue/AOD-20) §13 flagged, named here at their connections call sites.

| # | Surface today | Canonical (this design) | Kind |
|---|---|---|---|
| 1 | [`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx) renders **inline inside the row**, replacing the action. | The [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 **in-screen sheet** (scrim + `elevation.overlay` + grabber), the [`app-ia.md`](app-ia.md) §4.4 / §5 row 9 presentation. The connect / credential body is unchanged; only the presentation is canonicalized. | **canonicalize (AOD-21)** |
| 2 | [`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx): the field fills with `colors.background`; the placeholder hardcodes `#6B7280`. | The [AOD-20](https://linear.app/thexap/issue/AOD-20) §6 `input`: fill `surfaceAlt`, placeholder `-> textMuted`. | **canonicalize (AOD-20)** |
| 3 | [`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx): the Save / Search submit is `accent` **text**. | The [AOD-20](https://linear.app/thexap/issue/AOD-20) §5 **primary** button (`accent` fill, `onAccent` label); Cancel is the ghost / `textMuted` action. | **canonicalize (AOD-20)** |
| 4 | [`ConnectionRow.tsx`](../../apps/app/src/connections/ConnectionRow.tsx): the trailing actions are ad-hoc `Pressable` text (`accent`, or `error` for disconnect). | The [AOD-20](https://linear.app/thexap/issue/AOD-20) §5 buttons: `ghost` (Connect / Reconnect), `destructive` (Disconnect). The states and labels are unchanged. | **canonicalize (AOD-20)** |
| 5 | [`ConnectionsList.tsx`](../../apps/app/src/connections/ConnectionsList.tsx): the "Connections" heading and rows are an ad-hoc `View` with a custom heading. | The [AOD-20](https://linear.app/thexap/issue/AOD-20) §8 `rowGroup` with a `type.caption` heading, inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) §6 section slot. | **canonicalize** |
| 6 | Disconnect is **immediate** on tap (no confirmation). | A destructive-confirm dialog (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §9 center modal) before the credential is purged. | **add (flagged, optional)** |

These are **build** items (the PS-M2 / polish `type:tech-task`), not this design's edits; this design fixes the target, the build moves the call sites. The [AOD-20](https://linear.app/thexap/issue/AOD-20) / [AOD-21](https://linear.app/thexap/issue/AOD-21) group additions those designs already flagged are its inputs; this surface adds no token group of its own (section 9).

## 11. Seams left open (named, not decided)

| Seam | Owner | What this design leaves clean |
|---|---|---|
| **The connections polish build** (apply this design to [`ConnectionsList.tsx`](../../apps/app/src/connections/ConnectionsList.tsx) / [`ConnectionRow.tsx`](../../apps/app/src/connections/ConnectionRow.tsx) / [`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx); move the credential form into the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet) | a PS-M2 `type:tech-task` | The interior visuals are fixed here; the build implements them and reconciles section 10. No new token to add (section 9). |
| **The Themes picker interior** | nominally [AOD-28](https://linear.app/thexap/issue/AOD-28) ([`app-ia.md`](app-ia.md) §5 row 10); deferred | AOD-28's Must-cover is connections-centric and does not name Themes, so it is **flagged, not designed here**. The Themes nav row is the [AOD-21](https://linear.app/thexap/issue/AOD-21) §6 lock row; the picker interior is a small follow-up design or a build detail. |
| **The settings-home shell + the Account screen** | [AOD-21](https://linear.app/thexap/issue/AOD-21) | This design fills only the Connections section; the frame, the nav rows, and Account are fixed (section 7). |
| **The widget-instance config sheet** | [AOD-27](https://linear.app/thexap/issue/AOD-27) | This design owns the service credential form; the instance config sheet is AOD-27's (section 7). |
| **The OAuth broker internals + token model** (exchange, refresh, Vault, revoke) | [AOD-9](https://linear.app/thexap/issue/AOD-9) | This design places the connect handoff and the `vela://oauth/done` return; the broker is AOD-9's. |
| **The entitlement math + the full paywall layout** | [AOD-12](https://linear.app/thexap/issue/AOD-12) + [AOD-29](https://linear.app/thexap/issue/AOD-29) | The connect-limit lock routes to the Paywall (`trigger=services`); the cap predicate is [AOD-12](https://linear.app/thexap/issue/AOD-12)'s and the paywall body is [AOD-29](https://linear.app/thexap/issue/AOD-29)'s (section 8). |
| **The onboarding connect-first-service flow** | [AOD-29](https://linear.app/thexap/issue/AOD-29) | [AOD-29](https://linear.app/thexap/issue/AOD-29)'s onboarding **composes** this connections surface for its first connect (the `area:onboarding` seam on this issue); the connect path, the affordances, and the credential sheet are fixed here for it to reuse. |
| **The disconnect-confirm dialog** | the build (optional) | Named additively (section 10); disconnect is immediate today, a confirm is a reasonable extension, not silently added. |
| **Motion** (the sheet slide, the row action press, the connect spinner) | the build | Named; exact timings are a build refinement, the way [AOD-21](https://linear.app/thexap/issue/AOD-21) §10 and [AOD-27](https://linear.app/thexap/issue/AOD-27) §12 left motion to the build. |
| **Light-theme parity polish** | the build | The interior is defined in role terms, so light is a re-alias, not a redraw (the [AOD-20](https://linear.app/thexap/issue/AOD-20) §3 layering rule). |

## 12. Proposed acceptance

Proposed acceptance for this design (call out for confirmation):

> 1. **The connections list is fixed** (section 3; `design-settings-connections-list.svg`): the connected-services list inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) §6 Connections section, one [AOD-20](https://linear.app/thexap/issue/AOD-20) §8 row per `connectableServices()` overlaid with its live status, the registry seam, and the list-level loading / error states.
> 2. **The per-row states and the affordance matrix are fixed** (section 4; `design-settings-row-states.svg`): the `(authClass, status)` matrix `rowAction` derives (Connect / Add key / Set location, Disconnect, Reconnect, no action), the warning dot on a `reauth_required` row, the transient pending / inline-error states, and the card-prompt echo.
> 3. **The connect paths by `authClass` are fixed** (section 5; `design-settings-connect-paths.svg`): the `connectMechanism` branch, the `oauth2` system-browser round-trip to `vela://oauth/done` with no token on the device, and the key / location / none paths.
> 4. **The credential-entry sheet interior is fixed** (section 6; `design-settings-credential-sheet.svg`): the key field (`admin_key` / `api_key`) and the location search (`platform_key`) inside the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet, with the search sub-states and the no-secret location note.
> 5. **The ownership splits are stated** (section 7): the settings-home shell + Account are [AOD-21](https://linear.app/thexap/issue/AOD-21)'s, the widget-instance config sheet is [AOD-27](https://linear.app/thexap/issue/AOD-27)'s, and the Themes picker is flagged (section 11); the Gate / paywall connect-limit entry is placed (section 8).
> 6. **The work is handed forward** (sections 9 to 11): the surface adds **no new token group** (it composes [AOD-20](https://linear.app/thexap/issue/AOD-20) + [AOD-21](https://linear.app/thexap/issue/AOD-21)), the reconciliation with the shipped surfaces is named (the inline form -> the [AOD-21](https://linear.app/thexap/issue/AOD-21) §7 sheet, the field / placeholder / submit drifts), and the seams are left clean; no code is changed. The **four mockups render** in the house dark style.

| Acceptance clause | Where |
|---|---|
| Connections list: filled section, registry-driven, list states | Section 3; `design-settings-connections-list.svg` |
| Per-row states: the affordance matrix, transient states, the card echo | Section 4; `design-settings-row-states.svg` |
| Connect paths: the branch, the OAuth round-trip, key/location/none | Section 5; `design-settings-connect-paths.svg` |
| Credential sheet: the key + location interiors, sub-states | Section 6; `design-settings-credential-sheet.svg` |
| Ownership splits (AOD-21 shell + Account, AOD-27 config sheet); the Gate | Sections 7, 8 |
| No new token; reconciliation; seams (incl. the Themes flag) | Sections 9, 10, 11 |

## 13. References

- [AOD-28](https://linear.app/thexap/issue/AOD-28): this design's tracking issue (`type:design`, `area:app` + `area:onboarding`; milestone PS-M2 "App shell", project Platform & App Shell).
- [AOD-21](https://linear.app/thexap/issue/AOD-21) ([`design-core-navigation.md`](design-core-navigation.md)): the app shell this applies. §6 the settings-home shell + the Account screen + the Connections section placement, §7 the in-screen sheet presentation chrome, §8 the screen states. The direct upstream.
- [AOD-17](https://linear.app/thexap/issue/AOD-17) ([`app-ia.md`](app-ia.md)): the IA. §5 rows 7 / 8 / 9 / 11 the surfaces, §4.4 the presentation rule, §7 the connect-service entry, §8 the `vela://oauth/done` deep-link.
- [AOD-27](https://linear.app/thexap/issue/AOD-27) ([`design-dashboard-editor.md`](design-dashboard-editor.md)): the sibling application of the shell; §9 the config-sheet-vs-credential-form ownership split this honors (section 7).
- [AOD-20](https://linear.app/thexap/issue/AOD-20) ([`design-component-library.md`](design-component-library.md)): the components every surface composes (list row, inputs + the search row, buttons incl `destructive`, sheets / modals, badges, the lock / PRO overlay). Reused, not redesigned.
- [AOD-37](https://linear.app/thexap/issue/AOD-37) ([`design-widget-system.md`](design-widget-system.md)): §5 the host's `disconnected` / `needs_config` card prompts the connection state mirrors; §3.1 the status dot. Reused, not redrawn.
- [AOD-9](https://linear.app/thexap/issue/AOD-9) ([`oauth-token-model.md`](oauth-token-model.md)): §4 the credential classes, §7 the connect flows per class, §10 the disconnect flow; the broker internals this design places the handoff for.
- [AOD-19](https://linear.app/thexap/issue/AOD-19) / [AOD-66](https://linear.app/thexap/issue/AOD-66) ([`unistyles.ts`](../../apps/app/unistyles.ts)): the coded semantic roles, the `elevation` ladder, `scrim` / `onAccent` / `focusRing`, the `dot`, and the `type` / `spacing` scales the interior composes.
- [AOD-18](https://linear.app/thexap/issue/AOD-18) ([`design-brand.md`](design-brand.md)): the one-accent rule, the dark-first surface, and the calm voice the copy keeps.
- [AOD-8](https://linear.app/thexap/issue/AOD-8) ([`architecture-registry.md`](architecture-registry.md)) / [`registry.ts`](../../apps/app/src/registry/registry.ts): the services -> widgets -> layout seam the list preserves (`connectableServices()`, the affordance genericity).
- [AOD-12](https://linear.app/thexap/issue/AOD-12) ([`entitlement-model.md`](entitlement-model.md)) / [`Gate.tsx`](../../apps/app/src/entitlements/Gate.tsx): the UX-only gate the connect-limit lock coordinates with (`maxConnectedServices` -> Paywall).
- [AOD-29](https://linear.app/thexap/issue/AOD-29): the onboarding + full paywall design that composes this surface's connect-first-service flow (the `area:onboarding` seam).
- The shipped surfaces this canonicalizes: [`ConnectionsList.tsx`](../../apps/app/src/connections/ConnectionsList.tsx), [`ConnectionRow.tsx`](../../apps/app/src/connections/ConnectionRow.tsx), [`affordance.ts`](../../apps/app/src/connections/affordance.ts), [`CredentialForm.tsx`](../../apps/app/src/connections/CredentialForm.tsx), [`useConnections.ts`](../../apps/app/src/connections/useConnections.ts), [`connectionsRepo.ts`](../../apps/app/src/connections/connectionsRepo.ts), [`registry.ts`](../../apps/app/src/registry/registry.ts).
- [`engineering-process.md`](../engineering-process.md): the `type:design` lifecycle and deliverable convention this follows.
- Assets: [`design-settings-connections-list.svg`](assets/design-settings-connections-list.svg), [`design-settings-row-states.svg`](assets/design-settings-row-states.svg), [`design-settings-connect-paths.svg`](assets/design-settings-connect-paths.svg), [`design-settings-credential-sheet.svg`](assets/design-settings-credential-sheet.svg).
