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
  // uid on an error report is present when DHIS2 can attribute the error to
  // a specific submitted object (true for every event here, since every one
  // -- new or updated -- always carries a UID, client- or server-known; see
  // buildBatchEventPayload). NEEDS LIVE CONFIRMATION against a real batch
  // response before this field is trusted -- see the plan's Part D.
  validationReport?: { errorReports?: { message: string; uid?: string }[] }
  bundleReport?: { typeReportMap?: { EVENT?: { objectReports?: { uid: string }[] } } }
}

export function extractCreatedEventId(response: TrackerImportResponse): string | null {
  return response.bundleReport?.typeReportMap?.EVENT?.objectReports?.[0]?.uid ?? null
}

export function extractTrackerErrorMessage(response: TrackerImportResponse): string | null {
  const messages = response.validationReport?.errorReports?.map((r) => r.message) ?? []
  return messages.length > 0 ? messages.join(' ') : null
}

// ---- Batch submission (NEW -- not in the original bridge, which submits
// one event per HTTP call). buildEventPayload/buildUpdateEventPayload above
// stay untouched for parity with the source-of-truth repo; this app now
// uses the functions below instead, via dhis2ProvisioningIO.ts's
// submitEventBatch -- see useRunSync.ts.
//
// DHIS2's tracker import accepts many events in one POST. Its DEFAULT
// strategy (no importStrategy param, same as buildEventPayload's own call
// site already used) is CREATE_AND_UPDATE: an event whose UID doesn't
// exist yet is created, one whose UID matches an existing event is
// updated. New and updated events can therefore be mixed in ONE batch, as
// long as every event carries a UID up front -- so every 'new' item needs
// a client-generated UID here, rather than letting the server assign one
// (server-assigned UIDs are exactly what the old single-event
// buildEventPayload relied on, which is why batching wasn't possible
// without this change).

// DHIS2's own client-side UID scheme: 11 characters, first from [A-Za-z],
// the rest from [A-Za-z0-9]. Not cryptographically random -- matches what
// DHIS2 web clients generate; a collision would require matching an
// existing object's UID exactly, astronomically unlikely over this id
// space for a sync run's event volume.
const UID_FIRST_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
const UID_CHARS = UID_FIRST_CHARS + '0123456789'

export function generateUid(): string {
  let uid = UID_FIRST_CHARS[Math.floor(Math.random() * UID_FIRST_CHARS.length)]
  for (let i = 0; i < 10; i++) {
    uid += UID_CHARS[Math.floor(Math.random() * UID_CHARS.length)]
  }
  return uid
}

export interface BatchEventItem {
  // Freshly generated via generateUid() for a 'new' item -- ignored (the
  // existing id wins) when existingEventId is set.
  eventId: string
  existingEventId: string | null
  visit: MappedVisit
}

export function buildBatchEventPayload(items: BatchEventItem[], provisioned: ProvisionedProgram, orgUnitId: string) {
  return {
    events: items.map((item) => ({
      event: item.existingEventId ?? item.eventId,
      program: provisioned.programId,
      programStage: provisioned.programStageId,
      orgUnit: orgUnitId,
      occurredAt: item.visit.occurredAt,
      status: 'COMPLETED' as const,
      dataValues: buildDataValues(provisioned, item.visit),
    })),
  }
}

export interface BatchOutcome {
  succeeded: Set<string> // event UIDs (matches submittedEventIds' values)
  errors: { eventId: string; message: string }[]
}

// Cross-references the response against the UIDs actually submitted (not
// just whatever the response happens to mention), so a UID that comes back
// as neither a success nor a targeted error is treated as failed with a
// clear generic message -- never silently assumed to have succeeded.
export function parseTrackerBatchResult(response: TrackerImportResponse, submittedEventIds: string[]): BatchOutcome {
  const succeededUids = new Set((response.bundleReport?.typeReportMap?.EVENT?.objectReports ?? []).map((r) => r.uid))

  const messagesByUid = new Map<string, string[]>()
  for (const report of response.validationReport?.errorReports ?? []) {
    if (!report.uid) continue
    const list = messagesByUid.get(report.uid) ?? []
    list.push(report.message)
    messagesByUid.set(report.uid, list)
  }

  const succeeded = new Set<string>()
  const errors: { eventId: string; message: string }[] = []
  for (const eventId of submittedEventIds) {
    if (succeededUids.has(eventId)) {
      succeeded.add(eventId)
    } else if (messagesByUid.has(eventId)) {
      errors.push({ eventId, message: messagesByUid.get(eventId)!.join(' ') })
    } else {
      errors.push({ eventId, message: 'DHIS2 did not report a result for this event.' })
    }
  }
  return { succeeded, errors }
}
