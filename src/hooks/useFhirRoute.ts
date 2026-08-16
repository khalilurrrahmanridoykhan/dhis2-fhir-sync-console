// PRIMARY path: list existing wildcard Routes (GET /api/routes) and let the
// admin pick one -- set up via the official Route Manager app, or by this
// hook's own "create one for me" fallback below.
//
// CONFIRMED LIVE: POST /api/routes with this exact payload shape works.
// One real bug this caught: a newly-created Route defaults to fully
// PRIVATE sharing (`"public": "--------"`) -- confirmed live by creating a
// route as one user and then logging in as a second, properly-authorized
// user, who saw "No routes found" because they simply couldn't see it. For
// an app whose whole premise is a shared team control panel, one admin's
// route being invisible to everyone else defeats the point. Fixed by
// granting public read access right after creation, the same
// sharing-endpoint pattern already confirmed working for the Program (see
// dhis2ProvisioningIO.ts). Read-only, not read-write: a Route's `auth`
// config (credentials) is a write-only property DHIS2 never returns from a
// GET regardless of permissions, so granting read access doesn't expose
// secrets -- it only lets other users see the route exists and use it.

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

// Read-only public access -- see header comment for why this is safe
// (a Route's auth config is never returned from a GET, regardless of who's
// asking) and why it's necessary (routes default to fully private).
const ROUTE_SHARING_PAYLOAD = {
  object: { publicAccess: 'r-------', userGroupAccesses: [], userAccesses: [] },
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
      const routeId = response.response.uid
      await engine.mutate({
        resource: `sharing?type=route&id=${routeId}`,
        type: 'create',
        data: ROUTE_SHARING_PAYLOAD,
      })
      await refresh()
      return routeId
    },
    [engine, refresh],
  )

  return { loading, error, wildcardRoutes, refresh, createRoute }
}
