import { useDataQuery } from '@dhis2/app-runtime'

const query = {
  me: {
    resource: 'me',
    params: { fields: 'username,authorities' },
  },
}

interface MeResponse {
  me: { username: string; authorities: string[] }
}

export interface CurrentUserAuthorities {
  loading: boolean
  error: string | null
  username: string
  /** Can list/pick an existing Route -- true for any authenticated user;
   * listing routes isn't itself privileged, only creating/editing one is. */
  canListRoutes: boolean
  /** Can create a Route (ALL, or one of the two real create authorities the
   * Route schema actually exposes -- confirmed live via
   * GET /api/schemas/route.json, not guessed: F_ROUTE_PUBLIC_ADD and
   * F_ROUTE_PRIVATE_ADD). An earlier version of this check tested for a
   * literal authority string `'Route'`, which isn't a real DHIS2 authority
   * and always evaluated false for any non-superuser -- caught by actually
   * logging in as a scoped test role and seeing "you may not have
   * permission" even after granting F_ROUTE_PUBLIC_ADD. This is still only
   * a client-side UI check controlling whether the "create one for me"
   * fallback is offered -- the real, authoritative check is always the
   * server's own 403 on POST /api/routes, which useFhirRoute.ts surfaces as
   * its own clear error regardless of what this hook says. */
  canCreateRoutes: boolean
}

export function useCurrentUserAuthorities(): CurrentUserAuthorities {
  const { loading, error, data } = useDataQuery<MeResponse>(query)
  const authorities = data?.me.authorities ?? []
  return {
    loading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    username: data?.me.username ?? '',
    canListRoutes: true,
    canCreateRoutes:
      authorities.includes('ALL') || authorities.includes('F_ROUTE_PUBLIC_ADD') || authorities.includes('F_ROUTE_PRIVATE_ADD'),
  }
}
