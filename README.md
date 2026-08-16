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

## What's genuinely unverified -- read before relying on this in production

No account with Route authority was available during development (the shared `play.im.dhis2.org` demo admin got a real, live 403 trying to create one). Two real things are built from DHIS2's own documented API contracts but **not yet confirmed end-to-end against a live instance**:

1. **Route creation + FHIR pagination through it** (`src/hooks/useFhirRoute.ts`, `src/lib/fhirRouteFetch.ts`).
2. **The exact Tracker `importStrategy` mechanics for updating an existing event** via the modern `/api/tracker` endpoint (`src/lib/dhis2ProvisioningIO.ts`'s `submitUpdateEvent`) -- confirmed this is *not* the older `PUT /api/events/{id}` API, but the precise update payload/strategy value needs a real round-trip test.

**Do this before production use**: run both against a real DHIS2 instance where you hold Route authority, per the "Verification" section below.

## Everything else, reused/verified DHIS2 mechanics

Program/data element provisioning payload shapes (`src/reused/provisioning.ts`) are unchanged from the original bridge, confirmed live against `play.dhis2.org` (stable-2-43-1) in that project: a Program's `programStages` can't be nested in the creation POST, and sharing uses the `r-rw----` access string. The `dataStore` read-modify-write pattern (`src/lib/dataStore.ts`, every hook in `src/hooks/`) matches every sibling DHIS2 app in this developer's portfolio exactly. `POST /api/messageConversations` for error notifications is a real, documented DHIS2 endpoint.

## Design choices worth knowing about

- **No per-resource "retry" button.** A failed resource is never recorded as synced, so re-running "Preview sync" or "Sync now" naturally retries exactly what failed -- simpler and equally correct without a separate retry mechanism.
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
- Full test suite (`d2-app-scripts test`) -- 19 tests, covering the duplicated pure functions (extended with version-aware coverage) and the new classification logic (`src/lib/classifySync.ts`), hand-built fixtures.
- A real production build (`d2-app-scripts build`) -- succeeds, real icon confirmed in the generated manifest.

## Not yet done -- real, not deferred quietly

- Live end-to-end test of Route creation, FHIR pagination through a Route, and the Tracker update mechanics (see "What's genuinely unverified" above) -- needs an instance with Route authority.
- The CLI bridge doesn't write to `syncedVersions` or `runHistory` -- only this console does. A real v1.1.
- Settings aren't shared with the CLI (which still reads environment variables).
- Cross-link to Data Quality Auditor, and support for FHIR resource types beyond `Immunization` -- real, bigger future directions, not attempted here.

## License

MIT for the code in this repo. The duplicated files in `src/reused/` originate from `dhis2-fhir-immunization-bridge` (same MIT license, same author).
