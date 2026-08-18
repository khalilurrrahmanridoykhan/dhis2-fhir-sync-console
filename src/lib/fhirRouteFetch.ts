// Mirrors the original bridge's fhirClient.ts pagination LOGIC (follow the
// FHIR Bundle's own "next" link) but the request mechanism is completely
// different: every call goes through this DHIS2 instance's own
// /api/routes/{id}/run(/{subPath}), never fetch() straight to the FHIR
// server. See README for why (the March 2026 App Hub guideline on external
// credentials).
//
// Deliberately NOT using @dhis2/app-runtime's engine.query() here -- a real
// bug found live (dhis2.krrkhan.com, not a spec-reading guess): a FHIR
// server responds with `Content-Type: application/fhir+json` (correct per
// the FHIR spec), but @dhis2/data-engine's fetchData() only calls
// response.json() when the content type is EXACTLY `application/json`
// (strict equality, not a prefix/suffix check) -- anything else, including
// `application/fhir+json`, falls through to response.blob(), so
// engine.query() silently hands back an unparsed Blob instead of the FHIR
// Bundle. `response.result.entry` was then always undefined, and every real
// sync run through the app UI fetched 0 resources despite the Route itself
// working perfectly (confirmed by curl'ing the identical URL). Caught only
// by an actual click-through in a real browser -- curl-level route
// verification during earlier development couldn't have caught this, since
// curl doesn't route the response through @dhis2/data-engine's parser.
// Fixed by calling fetch() directly against this same-origin DHIS2 API
// (every DHIS2 App is always served same-origin with its own instance, so
// window.location.origin is always correct here) and always parsing the
// body as JSON ourselves, regardless of the declared content type.
//
// CONFIRMED LIVE against a real DHIS2 2.42.5 instance (dhis2.krrkhan.com)
// with a real Route to https://hapi.fhir.org/baseR4/**. One earlier bug this
// also caught: HAPI's own "next" link for page 2+ is the bare base URL with
// no resource-type segment at all (e.g.
// "https://hapi.fhir.org/baseR4?_getpages=...", not
// ".../baseR4/Immunization?..."). Stripping the base path off that leaves
// an EMPTY string, not null -- an earlier version of this function treated
// empty-string as "no next page" and silently stopped pagination after page
// 1. Fixed by tracking "is there a next page" via the presence of the
// `next` link itself, not by testing subPath's truthiness -- an empty
// subPath is real and means "call /run with no sub-path, params only".

import type { FhirBundle, FhirImmunization } from '../reused/types'

export interface FetchViaRouteOptions {
  routeId: string
  /** The FHIR server's own base URL, e.g. "https://hapi.fhir.org/baseR4" --
   * used only to strip that path prefix off a "next" link before
   * re-appending the remainder after /run/, since the Route's own url
   * already encodes it. */
  fhirBaseUrl: string
  pageCount: number
  maxPages: number
  /** ISO timestamp of the previous run's own start time, if any. When
   * present, only resources updated since then are fetched (FHIR's
   * standard `_lastUpdated=gt...` search param) -- a stable server no
   * longer gets fully re-walked on every run. Absent on the very first
   * run (no history yet), which fetches everything, same as before this
   * option existed. */
  sinceIso?: string
}

function routeRunUrl(routeId: string, subPath: string, params: Record<string, string>): string {
  const path = subPath ? `/api/routes/${routeId}/run/${subPath}` : `/api/routes/${routeId}/run`
  const query = new URLSearchParams(params).toString()
  return `${window.location.origin}${path}${query ? `?${query}` : ''}`
}

async function runRoute(routeId: string, subPath: string, params: Record<string, string>): Promise<FhirBundle> {
  const response = await fetch(routeRunUrl(routeId, subPath, params), {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!response.ok) {
    throw new Error(`FHIR route request failed: ${response.status} ${response.statusText}`)
  }
  // Deliberately not gated on Content-Type -- see header comment.
  return (await response.json()) as FhirBundle
}

export async function fetchImmunizationsViaRoute(options: FetchViaRouteOptions): Promise<FhirImmunization[]> {
  const resources: FhirImmunization[] = []
  const basePath = new URL(options.fhirBaseUrl).pathname.replace(/\/+$/, '')

  let subPath = 'Immunization'
  let params: Record<string, string> = {
    _count: String(options.pageCount),
    ...(options.sinceIso ? { _lastUpdated: `gt${options.sinceIso}` } : {}),
  }
  let hasNext = true
  let pages = 0

  while (hasNext && pages < options.maxPages) {
    const bundle = await runRoute(options.routeId, subPath, params)

    for (const entry of bundle.entry ?? []) {
      if (entry.resource) resources.push(entry.resource)
    }

    const next = (bundle.link ?? []).find((l) => l.relation === 'next')
    if (!next) {
      hasNext = false
      break
    }

    const nextUrl = new URL(next.url)
    let path = nextUrl.pathname
    if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length)
    subPath = path.replace(/^\/+/, '') // may legitimately be '' -- see header comment
    params = Object.fromEntries(nextUrl.searchParams)
    pages++
  }

  return resources
}
