// Duplicated from
// onehealth-platform/dhis2-fhir-immunization-bridge/src/dedupe.test.ts.

import { filterNewVisits } from './dedupe'
import type { MappedVisit } from './types'

function visit(id: string): MappedVisit {
  return {
    fhirImmunizationId: id,
    antigenName: 'Test antigen',
    vaccineCodingJson: '{}',
    status: 'completed',
    sourcePatientRef: null,
    lotNumber: null,
    occurredAt: '2026-08-11T00:00:00.000Z',
    versionId: '1',
  }
}

describe('filterNewVisits', () => {
  test('keeps all visits when nothing has been synced yet', () => {
    const result = filterNewVisits([visit('a'), visit('b')], new Set())
    expect(result.map((v) => v.fhirImmunizationId)).toEqual(['a', 'b'])
  })

  test('drops visits whose id is already in the synced set', () => {
    const result = filterNewVisits([visit('a'), visit('b'), visit('c')], new Set(['b']))
    expect(result.map((v) => v.fhirImmunizationId)).toEqual(['a', 'c'])
  })

  test('a full re-run against an unchanged synced set drops everything -- the core idempotency guarantee', () => {
    const visits = [visit('a'), visit('b'), visit('c')]
    const alreadySynced = new Set(visits.map((v) => v.fhirImmunizationId))
    expect(filterNewVisits(visits, alreadySynced)).toEqual([])
  })

  test('an empty batch returns an empty result regardless of the synced set', () => {
    expect(filterNewVisits([], new Set(['a', 'b']))).toEqual([])
  })
})
