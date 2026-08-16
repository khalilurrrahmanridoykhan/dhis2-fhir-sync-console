// Regression test for a real bug caught during live verification against
// dhis2.krrkhan.com: HAPI's own "next" link for page 2+ has no resource-type
// path segment at all, which used to make this function stop after page 1.
// The mock responses below are shaped exactly like the real ones observed
// live (see fhirRouteFetch.ts's header comment), not idealized.

import { fetchImmunizationsViaRoute } from './fhirRouteFetch'

function fakeEngine(queryImpl: (query: unknown) => Promise<unknown>) {
  return { query: queryImpl } as unknown as Parameters<typeof fetchImmunizationsViaRoute>[0]
}

describe('fetchImmunizationsViaRoute', () => {
  test('follows a "next" link that has no resource-type path segment (the real HAPI shape) instead of stopping after page 1', async () => {
    const calls: unknown[] = []
    const engine = fakeEngine(async (query) => {
      calls.push(query)
      const call = query as { result: { resource: string; params?: Record<string, string> } }
      if (call.result.resource === 'routes/r1/run/Immunization') {
        return {
          result: {
            resourceType: 'Bundle',
            entry: [{ resource: { resourceType: 'Immunization', id: 'a', status: 'completed', vaccineCode: {} } }],
            link: [
              { relation: 'self', url: 'https://hapi.fhir.org/baseR4/Immunization?_count=1' },
              // Real observed shape: bare base URL, no "/Immunization" segment.
              { relation: 'next', url: 'https://hapi.fhir.org/baseR4?_getpages=xyz&_getpagesoffset=1&_count=1' },
            ],
          },
        }
      }
      if (call.result.resource === 'routes/r1/run' && call.result.params?._getpages === 'xyz') {
        return {
          result: {
            resourceType: 'Bundle',
            entry: [{ resource: { resourceType: 'Immunization', id: 'b', status: 'completed', vaccineCode: {} } }],
            link: [{ relation: 'self', url: 'https://hapi.fhir.org/baseR4?_getpages=xyz&_getpagesoffset=1&_count=1' }],
          },
        }
      }
      throw new Error(`Unexpected query in test: ${JSON.stringify(query)}`)
    })

    const resources = await fetchImmunizationsViaRoute(engine, {
      routeId: 'r1',
      fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
      pageCount: 1,
      maxPages: 5,
    })

    expect(resources.map((r) => r.id)).toEqual(['a', 'b'])
    expect(calls).toHaveLength(2)
  })

  test('stops when a page has no "next" link', async () => {
    const engine = fakeEngine(async () => ({
      result: {
        resourceType: 'Bundle',
        entry: [{ resource: { resourceType: 'Immunization', id: 'only', status: 'completed', vaccineCode: {} } }],
        link: [{ relation: 'self', url: 'https://hapi.fhir.org/baseR4/Immunization?_count=20' }],
      },
    }))

    const resources = await fetchImmunizationsViaRoute(engine, {
      routeId: 'r1',
      fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
      pageCount: 20,
      maxPages: 5,
    })

    expect(resources.map((r) => r.id)).toEqual(['only'])
  })

  test('respects maxPages even if more "next" links are available', async () => {
    let call = 0
    const engine = fakeEngine(async () => {
      call++
      return {
        result: {
          resourceType: 'Bundle',
          entry: [{ resource: { resourceType: 'Immunization', id: `p${call}`, status: 'completed', vaccineCode: {} } }],
          link: [{ relation: 'next', url: `https://hapi.fhir.org/baseR4?_getpagesoffset=${call}` }],
        },
      }
    })

    const resources = await fetchImmunizationsViaRoute(engine, {
      routeId: 'r1',
      fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
      pageCount: 1,
      maxPages: 2,
    })

    expect(resources).toHaveLength(2)
  })
})
