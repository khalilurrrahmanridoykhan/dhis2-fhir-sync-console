// New tests for the batch-submission additions (generateUid,
// buildBatchEventPayload, parseTrackerBatchResult) -- not ported from the
// original bridge, since batching doesn't exist there.

import { buildBatchEventPayload, generateUid, parseTrackerBatchResult, type BatchEventItem, type TrackerImportResponse } from './provisioning'
import type { MappedVisit, ProvisionedProgram } from './types'

const provisioned: ProvisionedProgram = {
  programId: 'prog1',
  programStageId: 'stage1',
  dataElementIds: {
    fhirImmunizationId: 'de1',
    antigenName: 'de2',
    vaccineCodingJson: 'de3',
    status: 'de4',
    sourcePatientRef: 'de5',
    lotNumber: 'de6',
  },
}

function makeVisit(overrides: Partial<MappedVisit> = {}): MappedVisit {
  return {
    fhirImmunizationId: 'imm-1',
    antigenName: 'Influenza',
    vaccineCodingJson: '{}',
    status: 'completed',
    sourcePatientRef: null,
    lotNumber: null,
    occurredAt: '2026-01-01T00:00:00.000Z',
    versionId: '1',
    ...overrides,
  }
}

describe('generateUid', () => {
  test('is 11 characters, first letter, rest alphanumeric', () => {
    const uid = generateUid()
    expect(uid).toMatch(/^[A-Za-z][A-Za-z0-9]{10}$/)
  })

  test('produces different ids across calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateUid()))
    expect(ids.size).toBe(50)
  })
})

describe('buildBatchEventPayload', () => {
  test('uses the fresh eventId for a new item (no existingEventId)', () => {
    const items: BatchEventItem[] = [{ eventId: 'newUid12345', existingEventId: null, visit: makeVisit() }]
    const payload = buildBatchEventPayload(items, provisioned, 'ou1')
    expect(payload.events[0].event).toBe('newUid12345')
  })

  test('uses existingEventId (not eventId) for an updated item', () => {
    const items: BatchEventItem[] = [{ eventId: 'ignoredUid1', existingEventId: 'existingUid1', visit: makeVisit() }]
    const payload = buildBatchEventPayload(items, provisioned, 'ou1')
    expect(payload.events[0].event).toBe('existingUid1')
  })

  test('mixes new and updated events in one payload, in order', () => {
    const items: BatchEventItem[] = [
      { eventId: 'newA', existingEventId: null, visit: makeVisit({ fhirImmunizationId: 'imm-a' }) },
      { eventId: 'ignored', existingEventId: 'existingB', visit: makeVisit({ fhirImmunizationId: 'imm-b' }) },
    ]
    const payload = buildBatchEventPayload(items, provisioned, 'ou1')
    expect(payload.events.map((e) => e.event)).toEqual(['newA', 'existingB'])
    expect(payload.events.every((e) => e.program === 'prog1' && e.programStage === 'stage1' && e.orgUnit === 'ou1')).toBe(true)
  })
})

describe('parseTrackerBatchResult', () => {
  test('marks a uid succeeded when it appears in bundleReport objectReports', () => {
    const response: TrackerImportResponse = {
      status: 'OK',
      bundleReport: { typeReportMap: { EVENT: { objectReports: [{ uid: 'a' }, { uid: 'b' }] } } },
    }
    const outcome = parseTrackerBatchResult(response, ['a', 'b'])
    expect(outcome.succeeded).toEqual(new Set(['a', 'b']))
    expect(outcome.errors).toEqual([])
  })

  test('attributes a validation error to the right uid, joining multiple messages for the same uid', () => {
    const response: TrackerImportResponse = {
      status: 'ERROR',
      bundleReport: { typeReportMap: { EVENT: { objectReports: [{ uid: 'a' }] } } },
      validationReport: {
        errorReports: [
          { uid: 'b', message: 'Missing required data value.' },
          { uid: 'b', message: 'Invalid orgUnit.' },
        ],
      },
    }
    const outcome = parseTrackerBatchResult(response, ['a', 'b'])
    expect(outcome.succeeded).toEqual(new Set(['a']))
    expect(outcome.errors).toEqual([{ eventId: 'b', message: 'Missing required data value. Invalid orgUnit.' }])
  })

  test('treats a submitted uid absent from both reports as a failure with a generic message, never a silent success', () => {
    const response: TrackerImportResponse = { status: 'OK', bundleReport: { typeReportMap: { EVENT: { objectReports: [] } } } }
    const outcome = parseTrackerBatchResult(response, ['mystery'])
    expect(outcome.succeeded.size).toBe(0)
    expect(outcome.errors).toEqual([{ eventId: 'mystery', message: 'DHIS2 did not report a result for this event.' }])
  })

  test('ignores error reports with no uid rather than crashing', () => {
    const response: TrackerImportResponse = {
      status: 'ERROR',
      validationReport: { errorReports: [{ message: 'Some untargeted error.' }] },
    }
    const outcome = parseTrackerBatchResult(response, ['a'])
    expect(outcome.errors).toEqual([{ eventId: 'a', message: 'DHIS2 did not report a result for this event.' }])
  })
})
