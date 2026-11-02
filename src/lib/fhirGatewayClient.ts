// Talks to the standalone Java/Camel sync service (dhis2-route-b-sync) through a DHIS2
// Route, same mechanism as fhirRouteFetch.ts -- NOT for hiding credentials (the gateway
// has none), but so the browser never needs direct network access to that service, only
// DHIS2 itself does, and the gateway needs no CORS config of its own. Every call goes
// through this DHIS2 instance's own /api/routes/{id}/run(/{subPath}), same-origin.
export type SyncType =
  | 'immunization-to-fhir'
  | 'immunization-to-dhis2'
  | 'org-units-to-fhir'
  | 'option-sets-to-fhir'
  | 'tracked-entities-to-fhir'

export interface GatewaySyncLogEntry {
  id: number
  // Which of the five routes wrote this entry -- needed because "direction" alone can't
  // tell an Immunization entry apart from a metadata one (both use "dhis2-to-fhir" below).
  syncType: 'immunization' | 'org-unit' | 'option-set' | 'tracked-entity'
  // All five routes write SyncLog entries using these two literal direction values --
  // org-units/option-sets/tracked-entities are one-way, so always 'dhis2-to-fhir' for them.
  direction: 'dhis2-to-fhir' | 'fhir-to-dhis2'
  sourceId: string
  action: string
  message: string | null
  timestamp: string
}

export interface GatewayPreviewEntry {
  sourceId: string
  action: string
  message: string | null
}

function routeRunUrl(routeId: string, subPath: string): string {
  return `${window.location.origin}/api/routes/${routeId}/run/${subPath}`
}

export async function triggerGatewaySync(routeId: string, type: SyncType): Promise<void> {
  const response = await fetch(routeRunUrl(routeId, `api/sync/${type}`), {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `Gateway sync trigger failed: HTTP ${response.status}`)
  }
}

// Read-only: fetches and converts exactly like a real sync, minus the write step (see
// PreviewController.java) -- never creates/updates anything in DHIS2 or FHIR.
export async function fetchGatewayPreview(routeId: string, type: SyncType): Promise<GatewayPreviewEntry[]> {
  const response = await fetch(routeRunUrl(routeId, `api/preview/${type}`), {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!response.ok) {
    throw new Error(`Gateway preview failed: HTTP ${response.status}`)
  }
  return (await response.json()) as GatewayPreviewEntry[]
}

export async function fetchGatewaySyncHistory(routeId: string): Promise<GatewaySyncLogEntry[]> {
  const response = await fetch(routeRunUrl(routeId, 'api/sync-log'), {
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!response.ok) {
    throw new Error(`Gateway history fetch failed: HTTP ${response.status}`)
  }
  // Deliberately not gated on Content-Type -- see fhirRouteFetch.ts's header comment on
  // why engine.query()/its implicit parsing isn't used here.
  return (await response.json()) as GatewaySyncLogEntry[]
}
