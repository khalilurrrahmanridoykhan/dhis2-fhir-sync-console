// Additive, App-owned: fhirImmunizationBridge/runHistory. The CLI doesn't
// write here in v1 (a real, deferred v1.1 -- see README) -- history is only
// complete for runs triggered from this console.

import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import {
  BRIDGE_RESOURCE,
  CURRENT_SCHEMA_VERSION,
  RUN_HISTORY_KEY,
  isNotFoundError,
  type RunHistoryBlob,
  type RunHistoryEntry,
} from '../lib/dataStore'

interface State {
  loading: boolean
  error: string | null
  runs: RunHistoryEntry[]
}

interface DataStoreGetResponse {
  blob: RunHistoryBlob
}

// Keep at most this many runs -- unbounded growth of a single dataStore
// blob is a real, avoidable problem, not a hypothetical one.
const MAX_RETAINED_RUNS = 50

export interface UseRunHistoryResult extends State {
  refresh: () => Promise<void>
  appendRun: (entry: RunHistoryEntry) => Promise<void>
}

export function useRunHistory(): UseRunHistoryResult {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, runs: [] })
  const [keyExists, setKeyExists] = useState(false)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = (await engine.query({
        blob: { resource: BRIDGE_RESOURCE, id: RUN_HISTORY_KEY },
      })) as unknown as DataStoreGetResponse
      setKeyExists(true)
      setState({ loading: false, error: null, runs: response.blob.runs ?? [] })
    } catch (error) {
      if (isNotFoundError(error)) {
        setKeyExists(false)
        setState({ loading: false, error: null, runs: [] })
        return
      }
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), runs: [] })
    }
  }, [engine])

  useEffect(() => {
    load()
  }, [load])

  const appendRun = useCallback(
    async (entry: RunHistoryEntry) => {
      const runs = [entry, ...state.runs].slice(0, MAX_RETAINED_RUNS)
      const blob: RunHistoryBlob = { schemaVersion: CURRENT_SCHEMA_VERSION, runs }
      if (keyExists) {
        await engine.mutate({ resource: BRIDGE_RESOURCE, id: RUN_HISTORY_KEY, type: 'update', data: blob })
      } else {
        await engine.mutate({ resource: `${BRIDGE_RESOURCE}/${RUN_HISTORY_KEY}`, type: 'create', data: blob })
        setKeyExists(true)
      }
      setState({ loading: false, error: null, runs })
    },
    [engine, keyExists, state.runs],
  )

  return { ...state, refresh: load, appendRun }
}
