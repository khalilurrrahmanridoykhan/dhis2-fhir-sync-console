# FHIR Sync Console

A DHIS2 App control panel for [`dhis2-fhir-immunization-bridge`](https://github.com/khalilurrrahmanridoykhan/onehealth-platform/tree/main/dhis2-fhir-immunization-bridge) -- that project is a real, working FHIR→DHIS2 sync tool, but a Node CLI, deliberately not a DHIS2 App (a real interoperability bridge needs to poll an external server, a background-job shape DHIS2 Apps can't do). That leaves a real gap: no in-DHIS2 UI to configure it, trigger a run, or see what happened without SSH access. This fills that gap.

## Not a duplicate of anything -- checked, not assumed

The wider DHIS2 ecosystem's real prior art (the actual [`dhis2/dhis2-fhir-adapter`](https://github.com/dhis2/dhis2-fhir-adapter), now maintained at ITINordic/OpenSRP) is backend middleware, the same shape as the CLI bridge -- nobody had built a browser control panel for this class of tool. The [FHIR IG Generator](https://apps.dhis2.org) on App Hub is a different problem entirely: it generates FHIR Implementation Guide *documentation* from DHIS2 tracker metadata, and never touches a live FHIR server or moves real data -- this console executes a real sync, it doesn't help you write a spec for one.

## Why this goes through a DHIS2 Route, not a direct browser fetch

The first draft of this assumed the App would `fetch()` the FHIR server directly from the browser -- confirmed technically possible for the public [HAPI FHIR test server](https://hapi.fhir.org/baseR4) (`Access-Control-Allow-Origin: *`). Checking DHIS2's *current* App Hub guidelines caught a real problem: DHIS2 updated the guidelines in **March 2026** specifically about this -- apps must not hold third-party credentials in browser-readable code and call external APIs directly. The real point of this console is connecting to a *production* FHIR server, which needs authentication -- direct-fetch-with-stored-credentials is exactly the pattern that guideline exists to stop.

The fix: DHIS2 **Routes** (`POST /api/routes`, documented as of DHIS2 2.40). A Route is a server-side proxy -- DHIS2 itself makes the outbound call, credentials are encrypted at rest, this App only ever calls `/api/routes/{id}/run`, same-origin. This also makes CORS/CSP a non-issue: the browser never talks cross-origin at all.

**This console doesn't own Route creation as its primary path.** DHIS2 already ships an official [Route Manager](https://apps.dhis2.org) app for exactly that. This console primarily lets you *pick* an existing wildcard route, with a link to Route Manager if you need to create or edit one -- more consistent with how a DHIS2 admin already centralizes Routes across tools than reimplementing that UI here. An inline "create one for me" fallback is available for a quick first start.

## Code reuse: duplicated, not imported -- a real, named tradeoff

This is a **separate repo** from `onehealth-platform` (where the CLI bridge lives), not a monorepo sibling -- same standalone treatment as this developer's other geography/analysis projects. That breaks the cleanest reuse option (importing the bridge's pure functions directly via a relative path), so the small set of genuinely pure, reusable files -- `mapping.ts`, the pure payload-builder exports of `provisioning.ts`, `dedupe.ts`'s `filterNewVisits` -- are **duplicated** into `src/reused/`, each with a header comment naming the original as the source of truth. **Real, stated risk**: the two copies can drift if one changes and not the other. No automated check for that exists yet (a real, reasonable future improvement, not attempted here).

`fhirClient.ts`'s pagination *logic* (follow the FHIR Bundle's own "next" link) was reimplemented fresh in `src/lib/fhirRouteFetch.ts` rather than copied, since the request mechanism changes completely (Route-proxied, never a direct external fetch).

## A real correctness gap this surfaced: version-aware re-sync

Both the CLI and the first draft of this plan only ever ask "have I synced this FHIR resource id before" -- once true, forever skipped. FHIR resources carry `meta.versionId`/`meta.lastUpdated`, which change on every edit. As originally scoped, a clinician correcting a mis-entered immunization on the FHIR side would never be reflected in DHIS2. Fixed here with an additive `fhirImmunizationBridge/syncedVersions` dataStore key (App-owned, doesn't touch the CLI's own `syncedIds` blob) tracking `{ fhirId: { versionId, dhis2EventId } }` -- a changed version triggers a Tracker **update** of the existing event, not a duplicate create. See `src/lib/classifySync.ts`.

## Live-verified against a real DHIS2 instance, not just the docs

No account with Route authority was available for the first pass of development (the shared `play.im.dhis2.org` demo admin got a real, live 403 trying to create one). Everything below was then run for real against a live DHIS2 2.42.5 instance with genuine `ALL` authority:

1. **Route creation** -- `POST /api/routes` with this console's exact payload shape (`src/hooks/useFhirRoute.ts`) returned a real `201 Created`, no changes needed.
2. **FHIR pagination through the Route** -- confirmed page 1 (`GET /api/routes/{id}/run/Immunization?_count=5`) returns a real FHIR Bundle, including real `meta.versionId`/`meta.lastUpdated` values (confirming the version-aware re-sync design above has real data to work with). **Caught and fixed a genuine bug in the process**: HAPI's own "next" link for page 2+ has no resource-type path segment at all (`https://hapi.fhir.org/baseR4?_getpages=...`, not `.../baseR4/Immunization?...`). The original pagination code treated the resulting empty sub-path as "no more pages" and silently stopped after page 1. Fixed in `src/lib/fhirRouteFetch.ts` to track "is there a next page" via the `next` link's presence, not sub-path truthiness -- confirmed live that `GET /api/routes/{id}/run?_getpages=...` (no sub-path, just query params) correctly proxies and returns page 2. A regression test (`src/lib/fhirRouteFetch.test.ts`) reproduces the exact real response shape that caused this.
3. **Tracker event creation** -- `buildEventPayload`'s exact shape, POSTed to `/api/tracker?async=false`, created a real event; `extractCreatedEventId`'s response path (`bundleReport.typeReportMap.EVENT.objectReports[0].uid`) matched exactly.
4. **Tracker event update mechanics** -- the previously-unconfirmed part: including the existing event's UID in the payload and posting to `/api/tracker?async=false&importStrategy=UPDATE` (`src/lib/dhis2ProvisioningIO.ts`'s `submitUpdateEvent`) returned `stats.updated: 1`, and reading the event back afterward confirmed the data values actually changed, on the *same* event UID -- a real update, not a duplicate create. No code changes needed here.

All test metadata (the Route, a test Program/ProgramStage/DataElements, test Events) was created with clearly-labeled "TEST"/"verification" names and fully deleted afterward (the Program/DataElements needed a DHIS2 soft-delete maintenance purge first, since they were blocked by soft-deleted Tracker events referencing them -- a real, standard DHIS2 safety behavior, not a bug).

5. **A real end-to-end click-through, not just API-level checks** -- clicking through Settings, Preview, and Confirm in an actual browser caught a bug none of the above could: `engine.query()` (`@dhis2/app-runtime`'s own HTTP layer) only parses a response as JSON when the `Content-Type` is *exactly* `application/json`. A FHIR server correctly responds with `application/fhir+json`, which silently fell through to `response.blob()` instead -- every real sync reported "Fetched 0" no matter what, despite the Route itself working perfectly (confirmed by curl'ing the identical URL). Fixed in `src/lib/fhirRouteFetch.ts` by calling `fetch()` directly against the same-origin DHIS2 API and always parsing JSON ourselves. Confirmed afterward with a real Confirm-and-sync run that created real Tracker events.
6. **Testing as a non-superuser, not just `admin`** -- created a genuinely scoped DHIS2 role and logged in as that user, which caught two more real bugs invisible from a superuser account: `canCreateRoutes` checked for a literal `'Route'` authority string that isn't real (always false for anyone but a superuser -- the actual authorities are `F_ROUTE_PUBLIC_ADD`/`F_ROUTE_PRIVATE_ADD`, confirmed via `GET /api/schemas/route.json`), and a newly-created Route defaults to fully private sharing, so only its creator could ever see or use it -- defeating the point of a shared team control panel. Fixed in `src/hooks/useCurrentUserAuthorities.ts` and `src/hooks/useFhirRoute.ts` (the latter now grants public read access right after creating a Route; safe to do since a Route's `auth` config is write-only and never returned from a GET regardless of permissions).
7. **Two more independent public FHIR servers, not just HAPI** -- connected and ran a real Preview sync against the [SMART Health IT sandbox](https://r4.smarthealthit.org) (same `_getpages`/`_getpagesoffset` pagination shape as HAPI -- fetched 100 real records across 5 real pages) and the [Firely public test server](https://server.fire.ly/r4) (a genuinely different pagination mechanism -- an opaque `?q=<token>` continuation link, not `_getpages` at all -- fetched all 14 available records across 3 real pages). Both worked correctly with **zero code changes**, meaningfully raising confidence that the pagination fix above is actually spec-compliant FHIR client behavior, not a narrow patch for one server's specific quirk.
8. **A stale-UI bug found by a screenshot, not by reading code** -- `useRunSync()` keeps its own internal `useSyncedIds()`/`useRunHistory()` hook instances, separate from the ones `App.tsx` uses to render the Run History table and Total Synced card (React hooks don't share state across separate calls). A real sync always persisted correctly -- confirmed live the dataStore blob was already right -- but the screen kept showing stale numbers until a full page reload, since `RunSyncButton`'s "Sync now" had no way to tell `App.tsx` to refetch at all, and `PreviewPanel`'s "Confirm and sync" only refreshed Run History, not the synced count. This one would never have shown up in automated testing that reads `body.innerText()` after a fresh navigation, since a fresh page load always mounts hooks with correct data -- it only showed up because a real screenshot of the actual running app showed two contradictory numbers on the same screen. Fixed with a shared `onSyncComplete` callback wired identically for both sync paths (`src/App.tsx`, `src/components/RunSyncButton.tsx`, `src/components/PreviewPanel.tsx`).

## Deploying: two real gotchas found by actually doing it

Deploying with `d2-app-scripts deploy` and then opening the app in a real browser (not just checking the build/deploy commands exit cleanly) surfaced two things worth knowing if you're deploying this yourself:

1. **Redeploying under an unchanged `version` can serve stale files.** DHIS2 stores each app under a version-named folder (`apps/{key}-{version}`) and appears to cache which folder is "current." Deploying twice with the same `version` in `package.json` re-uploaded new files to disk, but the instance kept serving the *old* `index.html` (old JS bundle hash, old page title) until the app was deleted (`DELETE /api/apps/{key}`) and redeployed under a bumped version. If a redeploy doesn't seem to take effect, bump the version rather than assuming the deploy itself failed.
2. **A small, non-resizing iframe height is normal, not a bug.** The DHIS2 Global Shell renders each app inside an iframe that started at a fixed 150px height in testing and didn't grow to fit content in an automated headless check. Confirmed this is universal Global Shell behavior, not specific to this app, by checking an already-working sibling app (Data Quality Auditor) under the same instance and getting the identical fixed height. If you're scripting a browser check against this app (or any DHIS2 app) and it looks like content never rendered, read the *inner* app iframe's own DOM directly (`/api/apps/{key}/index.html`), not the outer Global Shell wrapper -- the outer wrapper's own chrome (header, nav) renders fine long before you can tell whether the inner app did.

## Everything else, reused/verified DHIS2 mechanics

Program/data element provisioning payload shapes (`src/reused/provisioning.ts`) are unchanged from the original bridge, confirmed live against `play.dhis2.org` (stable-2-43-1) in that project: a Program's `programStages` can't be nested in the creation POST, and sharing uses the `r-rw----` access string. The `dataStore` read-modify-write pattern (`src/lib/dataStore.ts`, every hook in `src/hooks/`) matches every sibling DHIS2 app in this developer's portfolio exactly. `POST /api/messageConversations` for error notifications is a real, documented DHIS2 endpoint.

## Design choices worth knowing about

- **No per-resource "retry" button.** A failed resource is never recorded as synced, so re-running "Preview sync" or "Sync now" naturally retries exactly what failed -- simpler and equally correct without a separate retry mechanism.
- **Sync progress checkpoints every 10 events, not just at the end.** Found by actually interrupting a run live: `syncedIds`/`syncedVersions` used to be written once, after the whole loop finished, so a run killed partway through (browser closed, network drop) lost tracking of every event it had already created -- a retry would then recreate them as duplicates. Now flushed every `CHECKPOINT_INTERVAL` (10) successful writes, bounding the loss to at most that many items instead of the whole run (`src/hooks/useRunSync.ts`).
- **Preview mode runs the real fetch + map + classify pipeline**, stopping before any DHIS2 write -- not a separate mocked path, so what you see in preview is exactly what a real run would do.
- **OAuth2 automatic token refresh isn't supported** (not a native DHIS2 Route auth type). A manually-obtained, manually-rotated Bearer token works via the "Bearer token" auth option (uses the Route's `api-headers` auth type) -- covers SMART-on-FHIR-style servers that accept a static token, not ones that hard-require live token negotiation.
- **No scheduling inside the App.** Checked for a DHIS2-native way around this (a custom background job type); no public extensibility API for that exists, and Routes are strictly on-demand (`/run`) -- this is a real limitation, not unresearched. Still a manually-triggered action.
- **The CLI bridge is unmodified.** Everything here is either this App's own dataStore keys, or additive keys in the bridge's namespace it doesn't know about yet.

## Running

```bash
yarn install
yarn build       # or: yarn start, for local dev against a real DHIS2 instance
yarn test
```

## Verification performed

- `npx tsc --noEmit` -- clean.
- Full test suite (`d2-app-scripts test`) -- 25 tests, covering the duplicated pure functions (extended with version-aware coverage), the classification logic (`src/lib/classifySync.ts`), the settings-range validation (`src/lib/validation.ts`), and a regression test for the real pagination bug found live, all hand-built fixtures.
- A real production build (`d2-app-scripts build`) -- succeeds, real icon confirmed in the generated manifest.
- Live, end-to-end, against a real DHIS2 2.42.5 instance: Route creation, FHIR pagination through a Route (including the bug fix above), Tracker event create, and Tracker event update -- see "Live-verified against a real DHIS2 instance" above.

## Not yet done -- real, not deferred quietly

- The CLI bridge doesn't write to `syncedVersions` or `runHistory` -- only this console does. A real v1.1.
- Settings aren't shared with the CLI (which still reads environment variables).
- Cross-link to Data Quality Auditor, and support for FHIR resource types beyond `Immunization` -- real, bigger future directions, not attempted here.
- The full Preview → Confirm → Sync → History UI flow has been click-tested end-to-end on a live instance, as both a superuser and a scoped non-superuser role, including a real Confirm-and-sync run that created real Tracker events -- see "Live-verified against a real DHIS2 instance" above.
- Recommended production role authorities for a non-superuser using this console: `M_fhirsyncconsole` (required just to see the app in the menu -- DHIS2 gates every app behind its own module authority, core apps included, not something this app's own manifest controls), `F_ROUTE_PUBLIC_ADD` (only needed if that user should be able to create a Route, not just pick an existing one), and `F_PROGRAM_PUBLIC_ADD`/`F_PROGRAMSTAGE_ADD`/`F_DATAELEMENT_PUBLIC_ADD` (only needed the first time ever, to auto-provision the Program if it doesn't already exist -- every run after that just uses the existing one).
- **The "Open Route Manager" link assumes Route Manager is actually installed.** It isn't bundled with DHIS2 -- it's a separate official App Hub app, and clicking through to it on an instance that never installed it fails with DHIS2's own generic "Unable to find an app for this URL" error, which reads like this console is broken even though it's just a missing dependency. Install it from App Hub (App Management -> App Hub -> search "Route Manager") before relying on that link. If a non-superuser role needs to use it too, it needs its own module authority, `M_routemanager`, same rule as any other DHIS2 app.

## License

MIT for the code in this repo. The duplicated files in `src/reused/` originate from `dhis2-fhir-immunization-bridge` (same MIT license, same author).
