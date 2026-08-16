import { classifyVisits } from './classifySync'
import type { MappedVisit } from '../reused/types'

function visit(id: string, versionId: string | null): MappedVisit {
  return {
    fhirImmunizationId: id,
    antigenName: 'Test antigen',
    vaccineCodingJson: '{}',
    status: 'completed',
    sourcePatientRef: null,
    lotNumber: null,
    occurredAt: '2026-08-16T00:00:00.000Z',
    versionId,
  }
}

describe('classifyVisits', () => {
  test('a resource never synced before is "new"', () => {
    const [result] = classifyVisits([visit('a', '1')], new Set(), {})
    expect(result).toEqual({ kind: 'new', visit: visit('a', '1') })
  })

  test('a synced resource whose version matches is "unchanged", version known', () => {
    const [result] = classifyVisits([visit('a', '1')], new Set(['a']), { a: { versionId: '1', dhis2EventId: 'evt1' } })
    expect(result.kind).toBe('unchanged')
    if (result.kind === 'unchanged') expect(result.versionUnknown).toBe(false)
  })

  test('a synced resource whose version differs is "updated", carrying the existing DHIS2 event id', () => {
    const [result] = classifyVisits([visit('a', '2')], new Set(['a']), { a: { versionId: '1', dhis2EventId: 'evt1' } })
    expect(result).toEqual({ kind: 'updated', visit: visit('a', '2'), dhis2EventId: 'evt1' })
  })

  test('a resource synced only by the CLI (id known, no version recorded) is "unchanged" with versionUnknown=true, not an error', () => {
    const [result] = classifyVisits([visit('a', '1')], new Set(['a']), {})
    expect(result.kind).toBe('unchanged')
    if (result.kind === 'unchanged') expect(result.versionUnknown).toBe(true)
  })

  test('a resource with no versionId at all (meta absent) is treated as unchanged, never as updated', () => {
    // Can't detect a change without a version to compare -- must not
    // spuriously flag as "updated" just because versionId is null.
    const [result] = classifyVisits([visit('a', null)], new Set(['a']), { a: { versionId: '1', dhis2EventId: 'evt1' } })
    expect(result.kind).toBe('unchanged')
  })

  test('classifies a mixed batch correctly, preserving order', () => {
    const visits = [visit('new1', '1'), visit('same1', '1'), visit('changed1', '2')]
    const results = classifyVisits(visits, new Set(['same1', 'changed1']), {
      same1: { versionId: '1', dhis2EventId: 'e1' },
      changed1: { versionId: '1', dhis2EventId: 'e2' },
    })
    expect(results.map((r) => r.kind)).toEqual(['new', 'unchanged', 'updated'])
  })
})
