// Reads/writes the SAME fhirImmunizationBridge/syncedIds blob the CLI
// bridge already writes -- unchanged shape ({ schemaVersion, ids }), so
// whichever tool runs a sync, the other one's dedupe stays correct.

import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import { BRIDGE_RESOURCE, CURRENT_SCHEMA_VERSION, SYNCED_IDS_KEY, isNotFoundError, type SyncedIdsBlob } from '../lib/dataStore'

interface State {
  loading: boolean
  error: string | null
  ids: Set<string>
}

interface DataStoreGetResponse {
  blob: SyncedIdsBlob
}

export interface UseSyncedIdsResult extends State {
  refresh: () => Promise<void>
  saveIds: (ids: Set<string>) => Promise<void>
}

export function useSyncedIds(): UseSyncedIdsResult {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, ids: new Set() })
  const [keyExists, setKeyExists] = useState(false)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = (await engine.query({
        blob: { resource: BRIDGE_RESOURCE, id: SYNCED_IDS_KEY },
      })) as unknown as DataStoreGetResponse
      setKeyExists(true)
      setState({ loading: false, error: null, ids: new Set(response.blob.ids ?? []) })
    } catch (error) {
      if (isNotFoundError(error)) {
        // Expected if neither this App nor the CLI has ever synced anything yet.
        setKeyExists(false)
        setState({ loading: false, error: null, ids: new Set() })
        return
      }
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), ids: new Set() })
    }
  }, [engine])

  useEffect(() => {
    load()
  }, [load])

  const saveIds = useCallback(
    async (ids: Set<string>) => {
      const blob: SyncedIdsBlob = { schemaVersion: CURRENT_SCHEMA_VERSION, ids: [...ids] }
      if (keyExists) {
        await engine.mutate({ resource: BRIDGE_RESOURCE, id: SYNCED_IDS_KEY, type: 'update', data: blob })
      } else {
        await engine.mutate({ resource: `${BRIDGE_RESOURCE}/${SYNCED_IDS_KEY}`, type: 'create', data: blob })
        setKeyExists(true)
      }
      setState({ loading: false, error: null, ids })
    },
    [engine, keyExists],
  )

  return { ...state, refresh: load, saveIds }
}
