// Additive, App-owned: fhirImmunizationBridge/syncedVersions. The CLI
// doesn't read or write this key -- see the version-aware re-sync design
// in the plan/README. A resource this App has never seen a version for
// (e.g. one only the CLI ever synced) is simply absent here; that's treated
// as "needs a version check", not an error, by useRunSync.

import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import { BRIDGE_RESOURCE, CURRENT_SCHEMA_VERSION, SYNCED_VERSIONS_KEY, isNotFoundError, type SyncedVersionsBlob } from '../lib/dataStore'

interface State {
  loading: boolean
  error: string | null
  entries: SyncedVersionsBlob['entries']
}

interface DataStoreGetResponse {
  blob: SyncedVersionsBlob
}

export interface UseSyncedVersionsResult extends State {
  refresh: () => Promise<void>
  saveEntries: (entries: SyncedVersionsBlob['entries']) => Promise<void>
}

export function useSyncedVersions(): UseSyncedVersionsResult {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, entries: {} })
  const [keyExists, setKeyExists] = useState(false)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = (await engine.query({
        blob: { resource: BRIDGE_RESOURCE, id: SYNCED_VERSIONS_KEY },
      })) as unknown as DataStoreGetResponse
      setKeyExists(true)
      setState({ loading: false, error: null, entries: response.blob.entries ?? {} })
    } catch (error) {
      if (isNotFoundError(error)) {
        setKeyExists(false)
        setState({ loading: false, error: null, entries: {} })
        return
      }
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), entries: {} })
    }
  }, [engine])

  useEffect(() => {
    load()
  }, [load])

  const saveEntries = useCallback(
    async (entries: SyncedVersionsBlob['entries']) => {
      const blob: SyncedVersionsBlob = { schemaVersion: CURRENT_SCHEMA_VERSION, entries }
      if (keyExists) {
        await engine.mutate({ resource: BRIDGE_RESOURCE, id: SYNCED_VERSIONS_KEY, type: 'update', data: blob })
      } else {
        await engine.mutate({ resource: `${BRIDGE_RESOURCE}/${SYNCED_VERSIONS_KEY}`, type: 'create', data: blob })
        setKeyExists(true)
      }
      setState({ loading: false, error: null, entries })
    },
    [engine, keyExists],
  )

  return { ...state, refresh: load, saveEntries }
}
