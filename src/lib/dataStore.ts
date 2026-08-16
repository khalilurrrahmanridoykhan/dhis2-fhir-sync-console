// Same read-modify-write pattern confirmed working in every sibling app's
// own lib/dataStore.ts (Data Share Hub, Data Quality Auditor): a 'create'
// mutation rejects an `id` property at runtime even though the TS type
// allows it, so first-ever key creation embeds the key directly in
// `resource` instead. See the hooks that use these constants.
//
// Two separate namespaces, deliberately:
//  - `fhirSyncConsole` -- this app's own config, nothing else reads it.
//  - `fhirImmunizationBridge` -- the CLI bridge's own namespace. This app
//    reads/writes `syncedIds` there UNCHANGED (shared with the CLI), and
//    additively owns two new keys (`syncedVersions`, `runHistory`) the CLI
//    doesn't know about. See README for why this is additive, not a
//    breaking change to the CLI's own data.

export const CONSOLE_NAMESPACE = 'fhirSyncConsole'
export const CONSOLE_RESOURCE = `dataStore/${CONSOLE_NAMESPACE}`
export const SETTINGS_KEY = 'settings'

export const BRIDGE_NAMESPACE = 'fhirImmunizationBridge'
export const BRIDGE_RESOURCE = `dataStore/${BRIDGE_NAMESPACE}`
export const SYNCED_IDS_KEY = 'syncedIds'
export const SYNCED_VERSIONS_KEY = 'syncedVersions'
export const RUN_HISTORY_KEY = 'runHistory'

export const CURRENT_SCHEMA_VERSION = 1 as const

export type FhirAuthType = 'none' | 'http-basic' | 'api-token' | 'api-headers' | 'api-query-params'

export interface SettingsBlob {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  routeId: string | null
  orgUnitId: string | null
  pageCount: number
  maxPages: number
  notifyUserGroupId: string | null
}

export function emptySettingsBlob(): SettingsBlob {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    routeId: null,
    orgUnitId: null,
    pageCount: 20,
    maxPages: 5,
    notifyUserGroupId: null,
  }
}

// Matches the CLI's own SyncedIdsBlob shape exactly (dedupe.ts in the
// original bridge) -- unchanged, so the CLI keeps reading/writing it fine.
export interface SyncedIdsBlob {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  ids: string[]
}

export function emptySyncedIdsBlob(): SyncedIdsBlob {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, ids: [] }
}

// New, this app only. See src/reused -- versionId comes from meta.versionId.
export interface SyncedVersionsBlob {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  entries: Record<string, { versionId: string; dhis2EventId: string }>
}

export function emptySyncedVersionsBlob(): SyncedVersionsBlob {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, entries: {} }
}

export interface RunHistoryEntry {
  timestamp: string
  fetched: number
  mappedOk: number
  created: number
  updated: number
  unchanged: number
  skippedMapping: number
  errors: number
}

export interface RunHistoryBlob {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION
  runs: RunHistoryEntry[]
}

export function emptyRunHistoryBlob(): RunHistoryBlob {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, runs: [] }
}

export function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /404|not\s*found/i.test(error.message)
}
