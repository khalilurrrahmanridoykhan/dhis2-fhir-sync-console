// Duplicated from onehealth-platform/dhis2-fhir-immunization-bridge/src/mapping.ts
// (as of this repo's initial commit) -- THAT file is the source of truth.
// Re-copy here if the mapping logic changes there. See README.
//
// Pure, synchronous mapping logic -- no network calls. Built directly
// against real observed data from the public HAPI FHIR R4 server: most
// Immunization resources there carry only `vaccineCode.text`, a minority
// carry a proper `coding[]`, and several optional fields are frequently
// absent.
//
// One addition beyond the original: `versionId` is carried through onto
// MappedVisit (from `meta.versionId`), which the original bridge doesn't
// need since it never re-syncs an updated resource.

import type { FhirImmunization, MappedVisit, SkippedResource } from './types'

export type MappingResult = { ok: true; visit: MappedVisit } | { ok: false; skipped: SkippedResource }

export function mapFhirImmunizationToVisit(resource: FhirImmunization): MappingResult {
  if (!resource.occurrenceDateTime) {
    return { ok: false, skipped: { fhirImmunizationId: resource.id, reason: 'missing occurrenceDateTime' } }
  }

  const coding = resource.vaccineCode.coding?.[0]
  const antigenName = coding?.display ?? resource.vaccineCode.text ?? 'Unknown'

  return {
    ok: true,
    visit: {
      fhirImmunizationId: resource.id,
      antigenName,
      vaccineCodingJson: JSON.stringify(resource.vaccineCode),
      status: resource.status,
      sourcePatientRef: resource.patient?.reference ?? null,
      lotNumber: resource.lotNumber ?? null,
      occurredAt: resource.occurrenceDateTime,
      versionId: resource.meta?.versionId ?? null,
    },
  }
}

export function mapAll(resources: FhirImmunization[]): { visits: MappedVisit[]; skipped: SkippedResource[] } {
  const visits: MappedVisit[] = []
  const skipped: SkippedResource[] = []
  for (const resource of resources) {
    const result = mapFhirImmunizationToVisit(resource)
    if (result.ok) visits.push(result.visit)
    else skipped.push(result.skipped)
  }
  return { visits, skipped }
}
