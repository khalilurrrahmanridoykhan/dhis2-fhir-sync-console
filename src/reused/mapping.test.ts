// Duplicated (and extended for the versionId addition) from
// onehealth-platform/dhis2-fhir-immunization-bridge/src/mapping.test.ts.

import { mapAll, mapFhirImmunizationToVisit } from './mapping'
import type { FhirImmunization } from './types'

// Both base fixtures below are real resource shapes pulled live from
// https://hapi.fhir.org/baseR4/Immunization during the original bridge's
// build -- not synthesized idealized examples.

const textOnlyVaccineCode: FhirImmunization = {
  resourceType: 'Immunization',
  id: '137204398',
  status: 'completed',
  vaccineCode: { text: 'Influenza, seasonal' },
  patient: { reference: 'Patient/patient-abhin-at-v.com' },
  occurrenceDateTime: '2026-03-23T10:39:55.827Z',
  meta: { versionId: '1', lastUpdated: '2026-03-23T10:39:55.827Z' },
}

const codedVaccineCode: FhirImmunization = {
  resourceType: 'Immunization',
  id: '137230052',
  status: 'completed',
  vaccineCode: {
    coding: [{ system: 'http://snomed.info/sct', code: '1119349007', display: 'mRNA vaccine product' }],
    text: 'COVID-19 mRNA vaccine',
  },
  patient: { reference: 'Patient/137230016' },
  occurrenceDateTime: '2024-03-10T11:00:00+02:00',
  lotNumber: 'BNT-2024-001',
  primarySource: true,
  meta: { versionId: '2', lastUpdated: '2024-03-10T11:00:00+02:00' },
}

describe('mapFhirImmunizationToVisit', () => {
  test('falls back to vaccineCode.text when there is no coding array -- the common case in real data', () => {
    const result = mapFhirImmunizationToVisit(textOnlyVaccineCode)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.visit.antigenName).toBe('Influenza, seasonal')
      expect(result.visit.fhirImmunizationId).toBe('137204398')
      expect(result.visit.lotNumber).toBeNull()
    }
  })

  test('prefers coding[0].display over text when a proper coding is present', () => {
    const result = mapFhirImmunizationToVisit(codedVaccineCode)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.visit.antigenName).toBe('mRNA vaccine product')
      expect(result.visit.lotNumber).toBe('BNT-2024-001')
    }
  })

  test('keeps the full vaccineCode object as JSON regardless of which readable field was used', () => {
    const result = mapFhirImmunizationToVisit(codedVaccineCode)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const parsed = JSON.parse(result.visit.vaccineCodingJson)
      expect(parsed.coding[0].code).toBe('1119349007')
      expect(parsed.text).toBe('COVID-19 mRNA vaccine')
    }
  })

  test('falls back to "Unknown" when neither coding nor text is present', () => {
    const resource: FhirImmunization = { ...textOnlyVaccineCode, vaccineCode: {} }
    const result = mapFhirImmunizationToVisit(resource)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.antigenName).toBe('Unknown')
  })

  test('skips a resource missing occurrenceDateTime rather than guessing a date', () => {
    const resource: FhirImmunization = { ...textOnlyVaccineCode, occurrenceDateTime: undefined }
    const result = mapFhirImmunizationToVisit(resource)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.skipped.fhirImmunizationId).toBe('137204398')
      expect(result.skipped.reason).toContain('occurrenceDateTime')
    }
  })

  test('maps sourcePatientRef to null, not a fabricated value, when patient is absent', () => {
    const resource: FhirImmunization = { ...textOnlyVaccineCode, patient: undefined }
    const result = mapFhirImmunizationToVisit(resource)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.sourcePatientRef).toBeNull()
  })

  // New coverage, not in the original bridge (which never reads meta.versionId).
  test('carries meta.versionId through onto the mapped visit, for version-aware re-sync', () => {
    const result = mapFhirImmunizationToVisit(codedVaccineCode)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.versionId).toBe('2')
  })

  test('maps versionId to null, not a fabricated value, when meta is absent', () => {
    const resource: FhirImmunization = { ...textOnlyVaccineCode, meta: undefined }
    const result = mapFhirImmunizationToVisit(resource)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.visit.versionId).toBeNull()
  })
})

describe('mapAll', () => {
  test('partitions a mixed batch into visits and skipped, preserving order within each', () => {
    const missingDate: FhirImmunization = { ...textOnlyVaccineCode, id: 'missing-date', occurrenceDateTime: undefined }
    const { visits, skipped } = mapAll([textOnlyVaccineCode, missingDate, codedVaccineCode])
    expect(visits.map((v) => v.fhirImmunizationId)).toEqual(['137204398', '137230052'])
    expect(skipped.map((s) => s.fhirImmunizationId)).toEqual(['missing-date'])
  })
})
