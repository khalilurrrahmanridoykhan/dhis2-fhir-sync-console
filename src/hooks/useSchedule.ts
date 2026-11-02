import { useCallback, useEffect, useState } from 'react'
import type { SyncType } from '../lib/fhirGatewayClient'
import {
  cancelOneTimeRun,
  fetchSchedules,
  scheduleOneTimeRun,
  updateSchedule,
  type ScheduleMode,
  type ScheduleView,
} from '../lib/scheduleClient'

interface State {
  loading: boolean
  error: string | null
  schedules: ScheduleView[]
  saving: SyncType | null
}

export interface UseScheduleResult extends State {
  refresh: () => Promise<void>
  save: (type: SyncType, mode: ScheduleMode, intervalHours: number) => Promise<void>
  runAt: (type: SyncType, timestampIso: string) => Promise<void>
  cancelRunAt: (type: SyncType) => Promise<void>
}

export function useSchedule(routeId: string | null): UseScheduleResult {
  const [state, setState] = useState<State>({ loading: false, error: null, schedules: [], saving: null })

  const refresh = useCallback(async () => {
    if (!routeId) {
      setState((prev) => ({ ...prev, loading: false, error: null, schedules: [] }))
      return
    }
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const schedules = await fetchSchedules(routeId)
      setState((prev) => ({ ...prev, loading: false, schedules }))
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error instanceof Error ? error.message : String(error) }))
    }
  }, [routeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  function replaceOne(view: ScheduleView) {
    setState((prev) => ({ ...prev, schedules: prev.schedules.map((s) => (s.syncType === view.syncType ? view : s)) }))
  }

  const save = useCallback(
    async (type: SyncType, mode: ScheduleMode, intervalHours: number) => {
      if (!routeId) return
      setState((prev) => ({ ...prev, saving: type, error: null }))
      try {
        const view = await updateSchedule(routeId, type, mode, intervalHours)
        replaceOne(view)
      } catch (error) {
        setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : String(error) }))
      } finally {
        setState((prev) => ({ ...prev, saving: null }))
      }
    },
    [routeId],
  )

  const runAt = useCallback(
    async (type: SyncType, timestampIso: string) => {
      if (!routeId) return
      setState((prev) => ({ ...prev, saving: type, error: null }))
      try {
        const view = await scheduleOneTimeRun(routeId, type, timestampIso)
        replaceOne(view)
      } catch (error) {
        setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : String(error) }))
      } finally {
        setState((prev) => ({ ...prev, saving: null }))
      }
    },
    [routeId],
  )

  const cancelRunAt = useCallback(
    async (type: SyncType) => {
      if (!routeId) return
      setState((prev) => ({ ...prev, saving: type, error: null }))
      try {
        const view = await cancelOneTimeRun(routeId, type)
        replaceOne(view)
      } catch (error) {
        setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : String(error) }))
      } finally {
        setState((prev) => ({ ...prev, saving: null }))
      }
    },
    [routeId],
  )

  return { ...state, refresh, save, runAt, cancelRunAt }
}
