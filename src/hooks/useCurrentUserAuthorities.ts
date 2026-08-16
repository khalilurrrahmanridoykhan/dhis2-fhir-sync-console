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
  /** Can create a Route (ALL or the specific Route authority). This is the
   * client-side check controlling whether the "create one for me" fallback
   * is even offered -- the real, authoritative check is always the server's
   * own 403 on POST /api/routes, which useFhirRoute.ts surfaces as its own
   * clear error regardless of what this hook says (same discipline as every
   * sibling app's own authority-check hook: client-side is UI-only, never
   * treated as a guarantee). */
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
    canCreateRoutes: authorities.includes('ALL') || authorities.includes('Route'),
  }
}
