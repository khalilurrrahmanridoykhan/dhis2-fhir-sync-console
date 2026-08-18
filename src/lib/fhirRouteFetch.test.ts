// Regression tests for two real bugs caught during live verification against
// dhis2.krrkhan.com, not idealized/spec-reading guesses:
//
// 1. A FHIR server responds with `Content-Type: application/fhir+json`.
//    @dhis2/data-engine's fetchData() only calls response.json() on an
//    EXACT match of `application/json`, so routing this through
//    engine.query() silently returned an unparsed Blob -- every real run
//    fetched 0 resources despite the Route itself working (confirmed via
//    curl). Fixed by calling fetch() directly and always parsing as JSON
//    ourselves. These tests mock global fetch, not an engine, to match.
// 2. HAPI's own "next" link for page 2+ has no resource-type path segment
//    at all. The mock responses below are shaped exactly like the real ones
//    observed live (see fhirRouteFetch.ts's header comment).

import { fetchImmunizationsViaRoute } from './fhirRouteFetch'

function jsonResponse(body: unknown, contentType = 'application/fhir+json;charset=utf-8') {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
    headers: { get: () => contentType },
  } as unknown as Response
}

describe('fetchImmunizationsViaRoute', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('parses a real application/fhir+json response instead of treating it as an opaque blob', async () => {
    const calls: string[] = []
    global.fetch = jest.fn(async (url: string) => {
      calls.push(url)
      return jsonResponse({
        resourceType: 'Bundle',
        entry: [{ resource: { resourceType: 'Immunization', id: 'only', status: 'completed', vaccineCode: {} } }],
        link: [{ relation: 'self', url: 'https://hapi.fhir.org/baseR4/Immunization?_count=20' }],
      })
    }) as unknown as typeof fetch

    const resources = await fetchImmunizationsViaRoute({
      routeId: 'r1',
      fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
      pageCount: 20,
      maxPages: 5,
    })

    expect(resources.map((r) => r.id)).toEqual(['only'])
    expect(calls[0]).toContain('/api/routes/r1/run/Immunization')
    expect(calls[0]).toContain('_count=20')
  })

  test('follows a "next" link that has no resource-type path segment (the real HAPI shape) instead of stopping after page 1', async () => {
    const calls: string[] = []
    global.fetch = jest.fn(async (url: string) => {
      calls.push(url)
      if (url.includes('/run/Immunization')) {
        return jsonResponse({
          resourceType: 'Bundle',
          entry: [{ resource: { resourceType: 'Immunization', id: 'a', status: 'completed', vaccineCode: {} } }],
          link: [
            { relation: 'self', url: 'https://hapi.fhir.org/baseR4/Immunization?_count=1' },
            // Real observed shape: bare base URL, no "/Immunization" segment.
            { relation: 'next', url: 'https://hapi.fhir.org/baseR4?_getpages=xyz&_getpagesoffset=1&_count=1' },
          ],
        })
      }
      if (url.includes('/run?') && url.includes('_getpages=xyz')) {
        return jsonResponse({
          resourceType: 'Bundle',
          entry: [{ resource: { resourceType: 'Immunization', id: 'b', status: 'completed', vaccineCode: {} } }],
          link: [{ relation: 'self', url: 'https://hapi.fhir.org/baseR4?_getpages=xyz&_getpagesoffset=1&_count=1' }],
        })
      }
      throw new Error(`Unexpected fetch in test: ${url}`)
    }) as unknown as typeof fetch

    const resources = await fetchImmunizationsViaRoute({
      routeId: 'r1',
      fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
      pageCount: 1,
      maxPages: 5,
    })

    expect(resources.map((r) => r.id)).toEqual(['a', 'b'])
    expect(calls).toHaveLength(2)
  })

  test('stops when a page has no "next" link', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({
        resourceType: 'Bundle',
        entry: [{ resource: { resourceType: 'Immunization', id: 'only', status: 'completed', vaccineCode: {} } }],
        link: [{ relation: 'self', url: 'https://hapi.fhir.org/baseR4/Immunization?_count=20' }],
      }),
    ) as unknown as typeof fetch

    const resources = await fetchImmunizationsViaRoute({
      routeId: 'r1',
      fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
      pageCount: 20,
      maxPages: 5,
    })

    expect(resources.map((r) => r.id)).toEqual(['only'])
  })

  test('respects maxPages even if more "next" links are available', async () => {
    let call = 0
    global.fetch = jest.fn(async () => {
      call++
      return jsonResponse({
        resourceType: 'Bundle',
        entry: [{ resource: { resourceType: 'Immunization', id: `p${call}`, status: 'completed', vaccineCode: {} } }],
        link: [{ relation: 'next', url: `https://hapi.fhir.org/baseR4?_getpagesoffset=${call}` }],
      })
    }) as unknown as typeof fetch

    const resources = await fetchImmunizationsViaRoute({
      routeId: 'r1',
      fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
      pageCount: 1,
      maxPages: 2,
    })

    expect(resources).toHaveLength(2)
  })

  test('appends _lastUpdated=gt<sinceIso> to the first page when sinceIso is provided', async () => {
    const calls: string[] = []
    global.fetch = jest.fn(async (url: string) => {
      calls.push(url)
      return jsonResponse({
        resourceType: 'Bundle',
        entry: [],
        link: [{ relation: 'self', url: 'https://hapi.fhir.org/baseR4/Immunization' }],
      })
    }) as unknown as typeof fetch

    await fetchImmunizationsViaRoute({
      routeId: 'r1',
      fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
      pageCount: 20,
      maxPages: 5,
      sinceIso: '2026-01-01T00:00:00.000Z',
    })

    expect(calls[0]).toContain(`_lastUpdated=${encodeURIComponent('gt2026-01-01T00:00:00.000Z')}`)
  })

  test('omits _lastUpdated entirely when sinceIso is not provided (first-ever run, full fetch)', async () => {
    const calls: string[] = []
    global.fetch = jest.fn(async (url: string) => {
      calls.push(url)
      return jsonResponse({ resourceType: 'Bundle', entry: [], link: [] })
    }) as unknown as typeof fetch

    await fetchImmunizationsViaRoute({
      routeId: 'r1',
      fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
      pageCount: 20,
      maxPages: 5,
    })

    expect(calls[0]).not.toContain('_lastUpdated')
  })

  test('throws a clear error on a non-ok response instead of silently returning nothing', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({}),
      headers: { get: () => 'application/json' },
    })) as unknown as typeof fetch

    await expect(
      fetchImmunizationsViaRoute({
        routeId: 'r1',
        fhirBaseUrl: 'https://hapi.fhir.org/baseR4',
        pageCount: 20,
        maxPages: 5,
      }),
    ).rejects.toThrow('503')
  })
})
