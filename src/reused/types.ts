// Duplicated from onehealth-platform/dhis2-fhir-immunization-bridge/src/types.ts
// (as of this repo's initial commit) -- THAT file is the source of truth for
// the base FHIR/DHIS2 shapes. If the mapping logic changes there, these
// types need to be re-copied here too; this repo can't import it directly
// (see README for why: a separate repo, not a monorepo sibling).
//
// One deliberate addition beyond the original: `meta` on FhirImmunization,
// needed for this console's version-aware re-sync (the original bridge only
// ever asks "have I seen this id before", never "has it changed since").

export interface FhirCoding {
  system?: string
  code?: string
  display?: string
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[]
  text?: string
}

export interface FhirReference {
  reference?: string
}

export interface FhirMeta {
  versionId?: string
  lastUpdated?: string
}

export interface FhirImmunization {
  resourceType: 'Immunization'
  id: string
  status: string
  vaccineCode: FhirCodeableConcept
  patient?: FhirReference
  occurrenceDateTime?: string
  lotNumber?: string
  primarySource?: boolean
  meta?: FhirMeta
}

export interface FhirBundleEntry {
  fullUrl?: string
  resource?: FhirImmunization
}

export interface FhirBundle {
  resourceType: 'Bundle'
  entry?: FhirBundleEntry[]
  link?: { relation: string; url: string }[]
}

export interface FhirOperationOutcomeIssue {
  severity: string
  code: string
  diagnostics?: string
  details?: { text?: string }
}

export interface FhirOperationOutcome {
  resourceType: 'OperationOutcome'
  issue: FhirOperationOutcomeIssue[]
}

// The mapped, DHIS2-ready shape for one Immunization resource.
export interface MappedVisit {
  fhirImmunizationId: string
  antigenName: string
  vaccineCodingJson: string
  status: string
  sourcePatientRef: string | null
  lotNumber: string | null
  occurredAt: string
  // Not in the original bridge -- carried through so the classification
  // step (new/updated/unchanged) has something to compare against.
  versionId: string | null
}

export interface SkippedResource {
  fhirImmunizationId: string
  reason: string
}

export interface ProvisionedProgram {
  programId: string
  programStageId: string
  dataElementIds: {
    fhirImmunizationId: string
    antigenName: string
    vaccineCodingJson: string
    status: string
    sourcePatientRef: string
    lotNumber: string
  }
}
