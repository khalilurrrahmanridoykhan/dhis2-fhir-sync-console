// Talks to the standalone Java/Camel sync service (dhis2-route-b-sync), not the DHIS2
// Route-proxied path the rest of this console uses -- that service is this console's
// own backend, not a third-party FHIR server, so a direct same-purpose fetch is fine
// (the Route-proxy rule in the README is about third-party credentials, not this).
const GATEWAY_BASE_URL = 'http://localhost:8080'

// Matches SyncTriggerController's DIRECT_ENDPOINT_BY_TYPE keys on the Java side.
// Only immunization-* is genuinely two-way -- org-units/option-sets/tracked-entities
// are DHIS2 -> FHIR metadata sync only (see the project plan's origin-tracking addendum
// on why the reverse direction for metadata is out of scope for now).
export type SyncType =
  | 'immunization-to-fhir'
  | 'immunization-to-dhis2'
  | 'org-units-to-fhir'
  | 'option-sets-to-fhir'
  | 'tracked-entities-to-fhir'

export interface GatewaySyncLogEntry {
  id: number
  // Only the two Immunization routes write SyncLog entries today -- org-units/option-sets/
  // tracked-entities aren't instrumented yet, so they won't appear here even when triggered.
  direction: 'dhis2-to-fhir' | 'fhir-to-dhis2'
  sourceId: string
  action: string
  message: string | null
  timestamp: string
}

export async function triggerGatewaySync(type: SyncType): Promise<void> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/sync/${type}`, { method: 'POST' })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? `Gateway sync trigger failed: HTTP ${response.status}`)
  }
}

export async function fetchGatewaySyncHistory(): Promise<GatewaySyncLogEntry[]> {
  const response = await fetch(`${GATEWAY_BASE_URL}/api/sync-log`)
  if (!response.ok) {
    throw new Error(`Gateway history fetch failed: HTTP ${response.status}`)
  }
  return response.json()
}
