# Changelog

## 1.1.0

- Tracker event writes are now batched (up to 50 per bulk `/api/tracker` POST) instead of one HTTP call per event, using DHIS2's default CREATE_AND_UPDATE import strategy to mix new and updated events in the same batch. Per-resource error reporting is preserved via client-generated event UIDs.
- FHIR fetches are now incremental: a `_lastUpdated` filter, sourced from the previous run's own start time, means a stable server no longer gets fully re-walked on every run.
- Duplicate header bar removed (the App Platform already renders one), `coreCompatibility` removed from `d2.config.js`, `packageManager`/README brought back in line with the repo's real package manager (npm), and every user-facing string wrapped in `i18n.t()`.

(Versions 1.0.2-1.0.6 are not individually documented here -- see git history for the fixes between 1.0.1 and this release.)

## 1.0.1

- Redeployed under a bumped version to work around a DHIS2 app-cache issue where a redeploy under an unchanged version number kept serving the previous build. See the README's "Deploying: two real gotchas found by actually doing it" for details. No application code changed.

## 1.0.0

Initial release.

- Settings form: pick an existing DHIS2 Route to a FHIR server (or create one), target organisation unit, page size, max pages, error-notification user group.
- Preview a sync (fetch + map + classify, no writes) before running it for real.
- Version-aware re-sync: a FHIR resource whose `meta.versionId` changed since the last sync updates the existing DHIS2 Tracker event instead of skipping it or creating a duplicate.
- Run history and per-resource error reporting.
