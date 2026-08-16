import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useEffect, useState } from 'react'
import { CONSOLE_RESOURCE, CURRENT_SCHEMA_VERSION, SETTINGS_KEY, emptySettingsBlob, isNotFoundError, type SettingsBlob } from '../lib/dataStore'

interface State {
  loading: boolean
  error: string | null
  settings: SettingsBlob
}

interface DataStoreGetResponse {
  blob: SettingsBlob
}

export interface UseSettingsResult extends State {
  refresh: () => Promise<void>
  saveSettings: (settings: SettingsBlob) => Promise<void>
}

export function useSettings(): UseSettingsResult {
  const engine = useDataEngine()
  const [state, setState] = useState<State>({ loading: true, error: null, settings: emptySettingsBlob() })
  const [keyExists, setKeyExists] = useState(false)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = (await engine.query({
        blob: { resource: CONSOLE_RESOURCE, id: SETTINGS_KEY },
      })) as unknown as DataStoreGetResponse
      setKeyExists(true)
      setState({ loading: false, error: null, settings: response.blob })
    } catch (error) {
      if (isNotFoundError(error)) {
        setKeyExists(false)
        setState({ loading: false, error: null, settings: emptySettingsBlob() })
        return
      }
      setState({ loading: false, error: error instanceof Error ? error.message : String(error), settings: emptySettingsBlob() })
    }
  }, [engine])

  useEffect(() => {
    load()
  }, [load])

  const saveSettings = useCallback(
    async (settings: SettingsBlob) => {
      const blob: SettingsBlob = { ...settings, schemaVersion: CURRENT_SCHEMA_VERSION }
      if (keyExists) {
        await engine.mutate({ resource: CONSOLE_RESOURCE, id: SETTINGS_KEY, type: 'update', data: blob })
      } else {
        await engine.mutate({ resource: `${CONSOLE_RESOURCE}/${SETTINGS_KEY}`, type: 'create', data: blob })
        setKeyExists(true)
      }
      setState({ loading: false, error: null, settings: blob })
    },
    [engine, keyExists],
  )

  return { ...state, refresh: load, saveSettings }
}
