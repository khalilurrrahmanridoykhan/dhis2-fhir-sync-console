import { useCallback, useEffect, useState } from 'react'
import {
  fetchGatewaySyncHistory,
  triggerGatewaySync,
  type GatewaySyncLogEntry,
  type SyncType,
} from '../lib/fhirGatewayClient'

interface State {
  loading: boolean
  error: string | null
  history: GatewaySyncLogEntry[]
  triggering: SyncType | null
}

export interface UseFhirGatewayResult extends State {
  refresh: () => Promise<void>
  trigger: (type: SyncType) => Promise<void>
}

// routeId null means no gateway Route has been configured yet (see SettingsForm) --
// refresh/trigger become no-ops that surface a clear error instead of calling fetch()
// with a garbage URL.
export function useFhirGateway(routeId: string | null): UseFhirGatewayResult {
  const [state, setState] = useState<State>({ loading: false, error: null, history: [], triggering: null })

  const refresh = useCallback(async () => {
    if (!routeId) {
      setState((prev) => ({ ...prev, loading: false, error: null, history: [] }))
      return
    }
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const history = await fetchGatewaySyncHistory(routeId)
      setState((prev) => ({ ...prev, loading: false, history }))
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error instanceof Error ? error.message : String(error) }))
    }
  }, [routeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const trigger = useCallback(
    async (type: SyncType) => {
      if (!routeId) {
        setState((prev) => ({ ...prev, error: 'Pick or create a gateway Route in Settings first.' }))
        return
      }
      setState((prev) => ({ ...prev, triggering: type, error: null }))
      try {
        await triggerGatewaySync(routeId, type)
        await refresh()
      } catch (error) {
        setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : String(error) }))
      } finally {
        setState((prev) => ({ ...prev, triggering: null }))
      }
    },
    [routeId, refresh],
  )

  return { ...state, refresh, trigger }
}
