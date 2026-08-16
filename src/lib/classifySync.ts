// Pure classification logic -- no I/O -- so it's unit-testable in isolation,
// same discipline as the original bridge's mapping.ts/dedupe.ts. This is the
// NEW logic this console adds on top of the original bridge's simple
// "have I seen this id" check: new vs. updated vs. unchanged, using
// syncedVersions (see README's version-aware re-sync design).

import type { MappedVisit } from '../reused/types'

export interface ClassifiedNew {
  kind: 'new'
  visit: MappedVisit
}

export interface ClassifiedUpdated {
  kind: 'updated'
  visit: MappedVisit
  dhis2EventId: string
}

export interface ClassifiedUnchanged {
  kind: 'unchanged'
  visit: MappedVisit
  /** True when this console has never recorded a version for this id
   * (e.g. it was only ever synced by the CLI) -- treated as unchanged
   * rather than updated, since there's nothing to compare against, but
   * worth surfacing differently in the preview so it doesn't look like
   * "verified unchanged" when it's really "unknown, assumed fine". */
  versionUnknown: boolean
}

export type Classified = ClassifiedNew | ClassifiedUpdated | ClassifiedUnchanged

export function classifyVisits(
  visits: MappedVisit[],
  syncedIds: ReadonlySet<string>,
  syncedVersions: Readonly<Record<string, { versionId: string; dhis2EventId: string }>>,
): Classified[] {
  return visits.map((visit) => {
    if (!syncedIds.has(visit.fhirImmunizationId)) {
      return { kind: 'new', visit }
    }
    const existing = syncedVersions[visit.fhirImmunizationId]
    if (!existing) {
      return { kind: 'unchanged', visit, versionUnknown: true }
    }
    if (visit.versionId && visit.versionId !== existing.versionId) {
      return { kind: 'updated', visit, dhis2EventId: existing.dhis2EventId }
    }
    return { kind: 'unchanged', visit, versionUnknown: false }
  })
}
