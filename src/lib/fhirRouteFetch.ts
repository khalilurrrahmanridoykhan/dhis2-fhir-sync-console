// Mirrors the original bridge's fhirClient.ts pagination LOGIC (follow the
// FHIR Bundle's own "next" link) but the request mechanism is completely
// different: every call goes through this DHIS2 instance's own
// /api/routes/{id}/run/{subPath}, never fetch() straight to the FHIR
// server. See README for why (the March 2026 App Hub guideline on external
// credentials).
//
// UNVERIFIED LIVE (see README): confirm end-to-end against a real instance
// with a real Route before trusting this in production -- the only account
// available during development lacked Route authority.

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

export async function fetchImmunizationsViaRoute(engine: DataEngine, options: FetchViaRouteOptions): Promise<FhirImmunization[]> {
  const resources: FhirImmunization[] = []
  const basePath = new URL(options.fhirBaseUrl).pathname.replace(/\/+$/, '')

  let subPath: string | null = 'Immunization'
  let params: Record<string, string> | undefined = { _count: String(options.pageCount) }
  let pages = 0

  while (subPath && pages < options.maxPages) {
    const response = (await engine.query({
      result: { resource: `routes/${options.routeId}/run/${subPath}`, params },
    })) as unknown as RunRouteResponse

    for (const entry of response.result.entry ?? []) {
      if (entry.resource) resources.push(entry.resource)
    }

    const next = (response.result.link ?? []).find((l) => l.relation === 'next')
    if (!next) break

    const nextUrl = new URL(next.url)
    let path = nextUrl.pathname
    if (basePath && path.startsWith(basePath)) path = path.slice(basePath.length)
    subPath = path.replace(/^\/+/, '') || null
    params = Object.fromEntries(nextUrl.searchParams)
    pages++
  }

  return resources
}
