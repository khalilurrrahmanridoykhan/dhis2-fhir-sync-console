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

export function useFhirGateway(): UseFhirGatewayResult {
  const [state, setState] = useState<State>({ loading: true, error: null, history: [], triggering: null })

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const history = await fetchGatewaySyncHistory()
      setState((prev) => ({ ...prev, loading: false, history }))
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error instanceof Error ? error.message : String(error) }))
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const trigger = useCallback(
    async (type: SyncType) => {
      setState((prev) => ({ ...prev, triggering: type, error: null }))
      try {
        await triggerGatewaySync(type)
        await refresh()
      } catch (error) {
        setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : String(error) }))
      } finally {
        setState((prev) => ({ ...prev, triggering: null }))
      }
    },
    [refresh],
  )

  return { ...state, refresh, trigger }
}
