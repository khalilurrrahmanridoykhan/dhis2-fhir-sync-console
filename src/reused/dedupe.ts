// Duplicated (pure function only) from
// onehealth-platform/dhis2-fhir-immunization-bridge/src/dedupe.ts (as of
// this repo's initial commit) -- THAT file is the source of truth. The I/O
// wrappers (loadSyncedIds/saveSyncedIds) are NOT duplicated -- this repo's
// useSyncedIds.ts talks to the same dataStore blob via @dhis2/app-runtime
// directly. See README.

import type { MappedVisit } from './types'

export function filterNewVisits(visits: MappedVisit[], alreadySynced: ReadonlySet<string>): MappedVisit[] {
  return visits.filter((v) => !alreadySynced.has(v.fhirImmunizationId))
}
