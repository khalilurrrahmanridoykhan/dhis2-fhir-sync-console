// Mirrors the original bridge's fhirClient.ts pagination LOGIC (follow the
// FHIR Bundle's own "next" link) but the request mechanism is completely
// different: every call goes through this DHIS2 instance's own
// /api/routes/{id}/run(/{subPath}), never fetch() straight to the FHIR
// server. See README for why (the March 2026 App Hub guideline on external
// credentials).
//
// CONFIRMED LIVE against a real DHIS2 2.42.5 instance (dhis2.krrkhan.com)
// with a real Route to https://hapi.fhir.org/baseR4/**. One real bug this
// caught: HAPI's own "next" link for page 2+ is the bare base URL with no
// resource-type segment at all (e.g. "https://hapi.fhir.org/baseR4?_getpages=...",
// not ".../baseR4/Immunization?..."). Stripping the base path off that
// leaves an EMPTY string, not null -- an earlier version of this function
// treated empty-string as "no next page" and silently stopped pagination
// after page 1. Fixed by tracking "is there a next page" via the presence
// of the `next` link itself, not by testing subPath's truthiness -- an
// empty subPath is real and means "call /run with no sub-path, params only",
// confirmed to work via a live GET /api/routes/{id}/run?_getpages=...

import type { useDataEngine } from '@dhis2/app-runtime'
import type { FhirBundle, FhirImmunization } from '../reused/types'

// @dhis2/app-runtime doesn't re-export its DataEngine type directly (it
// lives in @dhis2/data-engine, a transitive dependency) -- ReturnType off
// the hook itself is the stable way to reference it.
type DataEngine = ReturnType<typeof useDataEngine>

interface RunRouteResponse {
  result: FhirBundle
}

export interface FetchViaRouteOptions {
  routeId: string
  /** The FHIR server's own base URL, e.g. "https://hapi.fhir.org/baseR4" --
   * used only to strip that path prefix off a "next" link before
   * re-appending the remainder after /run/, since the Route's own url
   * already encodes it. */
  fhirBaseUrl: string
  pageCount: number
  maxPages: number
}

function routeRunResource(routeId: string, subPath: string): string {
  return subPath ? `routes/${routeId}/run/${subPath}` : `routes/${routeId}/run`
}

export async function fetchImmunizationsViaRoute(engine: DataEngine, options: FetchViaRouteOptions): Promise<FhirImmunization[]> {
  const resources: FhirImmunization[] = []
  const basePath = new URL(options.fhirBaseUrl).pathname.replace(/\/+$/, '')

  let subPath = 'Immunization'
  let params: Record<string, string> | undefined = { _count: String(options.pageCount) }
  let hasNext = true
  let pages = 0

  while (hasNext && pages < options.maxPages) {
    const response = (await engine.query({
      result: { resource: routeRunResource(options.routeId, subPath), params },
    })) as unknown as RunRouteResponse

    for (const entry of response.result.entry ?? []) {
      if (entry.resource) resources.push(entry.resource)
    }

    const next = (response.result.link ?? []).find((l) => l.relation === 'next')
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
