// PRIMARY path: list existing wildcard Routes (GET /api/routes) and let the
// admin pick one -- set up via the official Route Manager app, or by this
// hook's own "create one for me" fallback below.
//
// UNVERIFIED LIVE (see README/plan): the exact `auth` sub-object shape for
// POST /api/routes hasn't been confirmed end-to-end against a real instance
// with Route authority (the only account available during development
// lacked it -- a real 403, not a guess). Built from DHIS2's own documented
// Route API; confirm the auth payload shape and a full round-trip before
// treating "create one for me" as production-ready.

import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import type { FhirAuthType } from '../lib/dataStore'

export interface RouteSummary {
  id: string
  name: string
  code: string | null
  url: string
}

interface RoutesListResponse {
  routes: { routes: { id: string; name: string; code: string | null; url: string }[] }
}

interface CreateRouteResponse {
  response: { uid: string }
}

export interface CreateRouteInput {
  name: string
  code: string
  /** Base FHIR server URL, e.g. "https://hapi.fhir.org/baseR4" -- this hook
   * appends "/**" itself, since a wildcard route is required to proxy a
   * paginated FHIR API (see README). */
  baseUrl: string
  authType: FhirAuthType
  /** Shape depends on authType: http-basic -> {username, password};
   * api-token -> {token}; api-headers -> {headers: {name: value}};
   * api-query-params -> {queryParams: {name: value}}. */
  authConfig?: Record<string, unknown>
  responseTimeoutSeconds: number
}

export interface UseFhirRouteResult {
  loading: boolean
  error: string | null
  /** Existing routes whose url ends in "/**" -- the only kind this console
   * can actually use, since a non-wildcard route can't proxy an arbitrary
   * FHIR sub-path (see README). Non-wildcard routes are filtered out here
   * rather than shown and failing later. */
  wildcardRoutes: RouteSummary[]
  refresh: () => Promise<void>
  createRoute: (input: CreateRouteInput) => Promise<string>
}

export function useFhirRoute(): UseFhirRouteResult {
  const engine = useDataEngine()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [wildcardRoutes, setWildcardRoutes] = useState<RouteSummary[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = (await engine.query({
        routes: { resource: 'routes', params: { fields: 'id,name,code,url', paging: 'false' } },
      })) as unknown as RoutesListResponse
      const all = response.routes.routes ?? []
      setWildcardRoutes(all.filter((r) => r.url.endsWith('/**')))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [engine])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createRoute = useCallback(
    async (input: CreateRouteInput): Promise<string> => {
      const payload: Record<string, unknown> = {
        name: input.name,
        code: input.code,
        url: `${input.baseUrl.replace(/\/+$/, '')}/**`,
        responseTimeoutSeconds: input.responseTimeoutSeconds,
      }
      if (input.authType !== 'none') {
        payload.auth = { type: input.authType, ...input.authConfig }
      }
      const response = (await engine.mutate({
        resource: 'routes',
        type: 'create',
        data: payload,
      })) as unknown as CreateRouteResponse
      await refresh()
      return response.response.uid
    },
    [engine, refresh],
  )

  return { loading, error, wildcardRoutes, refresh, createRoute }
}
