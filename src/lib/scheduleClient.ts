// Talks to ScheduleController.java through the same gateway Route as fhirGatewayClient.ts
// -- see that file's header comment for why a Route (not a direct browser fetch).
import type { SyncType } from './fhirGatewayClient'

export type ScheduleMode = 'AUTOMATIC' | 'MANUAL'

export interface ScheduleView {
  syncType: SyncType
  mode: ScheduleMode
  intervalHours: number
  lastRunAt: string | null
  /** ISO timestamp of a pending one-time run, if one is scheduled -- null otherwise. Lost
   * if the gateway service restarts, same caveat as ScheduleController's own comment. */
  pendingOneTimeRunAt: string | null
}

function routeRunUrl(routeId: string, subPath: string): string {
  return `${window.location.origin}/api/routes/${routeId}/run/${subPath}`
}

async function parseOrThrow<T>(response: Response, action: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `${action} failed: HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

export async function fetchSchedules(routeId: string): Promise<ScheduleView[]> {
  const response = await fetch(routeRunUrl(routeId, 'api/schedule'), {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  return parseOrThrow(response, 'Fetching schedules')
}

export async function updateSchedule(
  routeId: string,
  type: SyncType,
  mode: ScheduleMode,
  intervalHours: number,
): Promise<ScheduleView> {
  const response = await fetch(routeRunUrl(routeId, `api/schedule/${type}`), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, intervalHours }),
  })
  return parseOrThrow(response, 'Saving schedule')
}

export async function scheduleOneTimeRun(routeId: string, type: SyncType, timestampIso: string): Promise<ScheduleView> {
  const response = await fetch(routeRunUrl(routeId, `api/schedule/${type}/run-at`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp: timestampIso }),
  })
  return parseOrThrow(response, 'Scheduling one-time run')
}

export async function cancelOneTimeRun(routeId: string, type: SyncType): Promise<ScheduleView> {
  const response = await fetch(routeRunUrl(routeId, `api/schedule/${type}/run-at`), {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  return parseOrThrow(response, 'Cancelling one-time run')
}
