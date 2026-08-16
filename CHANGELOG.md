# Changelog

## 1.0.1

- Redeployed under a bumped version to work around a DHIS2 app-cache issue where a redeploy under an unchanged version number kept serving the previous build. See the README's "Deploying: two real gotchas found by actually doing it" for details. No application code changed.

## 1.0.0

Initial release.

- Settings form: pick an existing DHIS2 Route to a FHIR server (or create one), target organisation unit, page size, max pages, error-notification user group.
- Preview a sync (fetch + map + classify, no writes) before running it for real.
- Version-aware re-sync: a FHIR resource whose `meta.versionId` changed since the last sync updates the existing DHIS2 Tracker event instead of skipping it or creating a duplicate.
- Run history and per-resource error reporting.
