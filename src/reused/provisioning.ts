// Duplicated (pure exports only) from
// onehealth-platform/dhis2-fhir-immunization-bridge/src/provisioning.ts (as
// of this repo's initial commit) -- THAT file is the source of truth. The
// I/O wrapper functions (findOrCreateProgram, submitEvent, etc.) are NOT
// duplicated -- this repo reimplements those using @dhis2/app-runtime's
// engine.query/engine.mutate instead of the CLI's Node fetch+Basic-Auth
// client. See README.
//
// Payload shapes reused unchanged from the original, confirmed live against
// play.dhis2.org (stable-2-43-1): a Program's `programStages` array can't be
// nested in the creation POST (it silently fails), so the Program and its
// ProgramStage are created as two separate calls; a Program's sharing
// access string is `r-rw----` (metadata read-only, data read+write).

import type { MappedVisit, ProvisionedProgram } from './types'

export const PROGRAM_NAME = 'FHIR Immunization Bridge'
export const PROGRAM_STAGE_NAME = 'Synced immunization'

export type DataElementRole = 'fhirImmunizationId' | 'antigenName' | 'vaccineCodingJson' | 'status' | 'sourcePatientRef' | 'lotNumber'

export interface DataElementDef {
  role: DataElementRole
  name: string
  shortName: string
  valueType: 'TEXT' | 'LONG_TEXT'
}

export const DATA_ELEMENT_DEFS: DataElementDef[] = [
  { role: 'fhirImmunizationId', name: 'FHIR Bridge -- Source FHIR Immunization id', shortName: 'FHIR Bridge Source id', valueType: 'TEXT' },
  { role: 'antigenName', name: 'FHIR Bridge -- Antigen name', shortName: 'FHIR Bridge Antigen', valueType: 'TEXT' },
  { role: 'vaccineCodingJson', name: 'FHIR Bridge -- Vaccine coding (raw JSON)', shortName: 'FHIR Bridge Coding JSON', valueType: 'LONG_TEXT' },
  { role: 'status', name: 'FHIR Bridge -- Immunization status', shortName: 'FHIR Bridge Status', valueType: 'TEXT' },
  { role: 'sourcePatientRef', name: 'FHIR Bridge -- Source patient reference', shortName: 'FHIR Bridge Patient ref', valueType: 'TEXT' },
  { role: 'lotNumber', name: 'FHIR Bridge -- Lot number', shortName: 'FHIR Bridge Lot number', valueType: 'TEXT' },
]

export function buildDataElementPayload(def: DataElementDef) {
  return {
    name: def.name,
    shortName: def.shortName,
    domainType: 'TRACKER' as const,
    valueType: def.valueType,
    aggregationType: 'NONE' as const,
  }
}

export function buildProgramPayload(orgUnitIds: string[]) {
  return {
    name: PROGRAM_NAME,
    shortName: PROGRAM_NAME,
    programType: 'WITHOUT_REGISTRATION' as const,
    organisationUnits: orgUnitIds.map((id) => ({ id })),
  }
}

export function buildProgramStagePayload(programId: string, dataElementIds: Record<DataElementRole, string>) {
  return {
    name: PROGRAM_STAGE_NAME,
    program: { id: programId },
    programStageDataElements: DATA_ELEMENT_DEFS.map((def) => ({ dataElement: { id: dataElementIds[def.role] } })),
  }
}

export const PROGRAM_SHARING_PAYLOAD = {
  object: { publicAccess: 'r-rw----', userGroupAccesses: [], userAccesses: [] },
}

function buildDataValues(provisioned: ProvisionedProgram, visit: MappedVisit) {
  const dataValues: { dataElement: string; value: string }[] = [
    { dataElement: provisioned.dataElementIds.fhirImmunizationId, value: visit.fhirImmunizationId },
    { dataElement: provisioned.dataElementIds.antigenName, value: visit.antigenName },
    { dataElement: provisioned.dataElementIds.vaccineCodingJson, value: visit.vaccineCodingJson },
    { dataElement: provisioned.dataElementIds.status, value: visit.status },
  ]
  if (visit.sourcePatientRef) {
    dataValues.push({ dataElement: provisioned.dataElementIds.sourcePatientRef, value: visit.sourcePatientRef })
  }
  if (visit.lotNumber) {
    dataValues.push({ dataElement: provisioned.dataElementIds.lotNumber, value: visit.lotNumber })
  }
  return dataValues
}

export function buildEventPayload(provisioned: ProvisionedProgram, orgUnitId: string, visit: MappedVisit) {
  return {
    events: [
      {
        program: provisioned.programId,
        programStage: provisioned.programStageId,
        orgUnit: orgUnitId,
        occurredAt: visit.occurredAt,
        status: 'COMPLETED' as const,
        dataValues: buildDataValues(provisioned, visit),
      },
    ],
  }
}

// NEW -- not in the original bridge, which never re-syncs a changed
// resource. UNVERIFIED LIVE: the modern /api/tracker endpoint's exact
// update mechanics (this event UID + which importStrategy value) need
// confirming against a real instance before this is considered done -- see
// the plan's sequencing step 2. Best-effort per DHIS2's own Tracker docs:
// include the existing event's own `event` UID in the payload, and POST to
// /api/tracker?importStrategy=UPDATE (as opposed to the default CREATE
// used for buildEventPayload above).
export function buildUpdateEventPayload(provisioned: ProvisionedProgram, orgUnitId: string, existingEventId: string, visit: MappedVisit) {
  return {
    events: [
      {
        event: existingEventId,
        program: provisioned.programId,
        programStage: provisioned.programStageId,
        orgUnit: orgUnitId,
        occurredAt: visit.occurredAt,
        status: 'COMPLETED' as const,
        dataValues: buildDataValues(provisioned, visit),
      },
    ],
  }
}

export interface TrackerImportResponse {
  status: 'OK' | 'ERROR' | 'WARNING'
  validationReport?: { errorReports?: { message: string }[] }
  bundleReport?: { typeReportMap?: { EVENT?: { objectReports?: { uid: string }[] } } }
}

export function extractCreatedEventId(response: TrackerImportResponse): string | null {
  return response.bundleReport?.typeReportMap?.EVENT?.objectReports?.[0]?.uid ?? null
}

export function extractTrackerErrorMessage(response: TrackerImportResponse): string | null {
  const messages = response.validationReport?.errorReports?.map((r) => r.message) ?? []
  return messages.length > 0 ? messages.join(' ') : null
}
