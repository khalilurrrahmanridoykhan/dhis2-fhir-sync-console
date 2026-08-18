import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import { classifyVisits, type Classified } from '../lib/classifySync'
import { findOrCreateProgram, submitEventBatch } from '../lib/dhis2ProvisioningIO'
import { fetchImmunizationsViaRoute } from '../lib/fhirRouteFetch'
import { mapAll } from '../reused/mapping'
import { generateUid, type BatchEventItem } from '../reused/provisioning'
import type { SkippedResource } from '../reused/types'
import { useRunHistory } from './useRunHistory'
import { useSyncedIds } from './useSyncedIds'
import { useSyncedVersions } from './useSyncedVersions'
import { useSyncNotifications } from './useSyncNotifications'

// Real gap found live: syncedIds/syncedVersions used to be written only
// once, after the entire loop finished. A run interrupted partway through
// (browser closed, network drops, tab navigated away) lost tracking of
// every event it had already created, so a retry would recreate them as
// duplicates -- confirmed by literally hitting this during testing (a test
// script closed the browser mid-run; 69 real events existed with 0 of them
// recorded as synced). Checkpointing after every batch (see EVENT_BATCH_SIZE
// below) bounds the loss to at most one batch instead of the whole run.
// This checkpoints less often BY ITEM COUNT than the old per-10-items
// scheme, but the actual time window per checkpoint is shorter: a
// 50-event batch completes in one HTTP round trip instead of 50 sequential
// ones, so the wall-clock exposure is smaller even though more items sit
// inside it.
const EVENT_BATCH_SIZE = 50

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export interface RunSyncOptions {
  routeId: string
  fhirBaseUrl: string
  orgUnitId: string
  pageCount: number
  maxPages: number
  notifyUserGroupId: string | null
  /** Preview mode: run the fetch/map/classify pipeline but never write to
   * DHIS2 or persist any state. */
  preview: boolean
}

export interface SyncRunResult {
  fetched: number
  mappedOk: number
  created: number
  updated: number
  unchanged: number
  skippedMapping: SkippedResource[]
  errors: { fhirImmunizationId: string; message: string }[]
  /** Present for both preview and real runs -- what PreviewPanel renders. */
  classified: Classified[]
}

export interface UseRunSyncResult {
  running: boolean
  /** False until this hook's own internal syncedIds/syncedVersions/
   * runHistory instances have all finished their initial load. Real bug
   * found live: run() saves via saveIds/saveEntries, which decide
   * create-vs-update from each hook's own `keyExists` state -- if a sync
   * started before that state settled, saveIds would try to CREATE a key
   * that demonstrably already existed (dhis2.krrkhan.com already showed
   * 88 previously-synced ids), and DHIS2 correctly rejected it: "Key
   * 'syncedIds' already exists in namespace 'fhirImmunizationBridge'".
   * Callers (RunSyncButton/PreviewPanel) should disable their buttons
   * while this is false, and run() itself refuses to start until it's
   * true, so this can't be hit by clicking too early either way. */
  ready: boolean
  lastResult: SyncRunResult | null
  run: (options: RunSyncOptions) => Promise<SyncRunResult>
}

export function useRunSync(): UseRunSyncResult {
  const engine = useDataEngine()
  const { ids: syncedIds, loading: syncedIdsLoading, saveIds } = useSyncedIds()
  const { entries: syncedVersions, loading: syncedVersionsLoading, saveEntries } = useSyncedVersions()
  const { runs: pastRuns, loading: pastRunsLoading, appendRun } = useRunHistory()
  const { notifyOnErrors } = useSyncNotifications()

  const ready = !syncedIdsLoading && !syncedVersionsLoading && !pastRunsLoading

  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<SyncRunResult | null>(null)

  const run = useCallback(
    async (options: RunSyncOptions): Promise<SyncRunResult> => {
      if (!ready) {
        throw new Error('Still loading synced-id/version history -- wait a moment and try again.')
      }
      setRunning(true)
      try {
        // Captured before the fetch, not after the run completes -- used
        // both as this run's own history timestamp and, on the *next* run,
        // as the FHIR "_lastUpdated" cursor. Using the completion time
        // instead would create a real race: a FHIR resource updated while
        // THIS run was in flight could fall in the gap between "when this
        // run started reading" and "when it finished writing," and never
        // get picked up by a cursor based on the later time.
        const runStartedAt = new Date().toISOString()
        // Most recent past run's own start time, if any -- undefined on a
        // brand-new instance (no history yet), which correctly falls back
        // to fetching everything, same as today's behavior.
        const sinceIso = pastRuns[0]?.timestamp

        const resources = await fetchImmunizationsViaRoute({
          routeId: options.routeId,
          fhirBaseUrl: options.fhirBaseUrl,
          pageCount: options.pageCount,
          maxPages: options.maxPages,
          sinceIso,
        })
        const { visits, skipped } = mapAll(resources)
        const classified = classifyVisits(visits, syncedIds, syncedVersions)

        if (options.preview) {
          const result: SyncRunResult = {
            fetched: resources.length,
            mappedOk: visits.length,
            created: 0,
            updated: 0,
            unchanged: classified.filter((c) => c.kind === 'unchanged').length,
            skippedMapping: skipped,
            errors: [],
            classified,
          }
          setLastResult(result)
          return result
        }

        const provisioned = await findOrCreateProgram(engine, [options.orgUnitId])

        const errors: { fhirImmunizationId: string; message: string }[] = []
        const updatedSyncedIds = new Set(syncedIds)
        const updatedVersions = { ...syncedVersions }
        let created = 0
        let updated = 0

        // Only 'new'/'updated' need a write -- 'unchanged' has nothing to
        // submit. If versionUnknown, there's also nothing to *learn* yet
        // (no versionId was compared against anything), so updatedVersions
        // is intentionally left untouched for that case -- it'll be
        // populated the next time this resource is actually created or
        // updated.
        const writable = classified.filter((item): item is Extract<Classified, { kind: 'new' | 'updated' }> => item.kind !== 'unchanged')

        for (const batch of chunk(writable, EVENT_BATCH_SIZE)) {
          const items: BatchEventItem[] = batch.map((item) => ({
            eventId: item.kind === 'new' ? generateUid() : item.dhis2EventId,
            existingEventId: item.kind === 'updated' ? item.dhis2EventId : null,
            visit: item.visit,
          }))
          // Same order as `items` -- eventId here is always the id that was
          // actually submitted (existingEventId for an update, the fresh
          // one for a create), matching what parseTrackerBatchResult keys
          // its outcome by.
          const byEventId = new Map(items.map((bi, i) => [bi.existingEventId ?? bi.eventId, batch[i]]))

          const outcome = await submitEventBatch(engine, items, provisioned, options.orgUnitId)

          for (const eventId of outcome.succeeded) {
            const item = byEventId.get(eventId)
            if (!item) continue
            updatedSyncedIds.add(item.visit.fhirImmunizationId)
            if (item.visit.versionId) {
              updatedVersions[item.visit.fhirImmunizationId] = { versionId: item.visit.versionId, dhis2EventId: eventId }
            }
            if (item.kind === 'new') created++
            else updated++
          }
          for (const err of outcome.errors) {
            const item = byEventId.get(err.eventId)
            if (item) errors.push({ fhirImmunizationId: item.visit.fhirImmunizationId, message: err.message })
          }

          // Checkpoint after every batch -- see EVENT_BATCH_SIZE's own
          // comment for why this is safe despite checkpointing less often
          // by item count than the old per-10-items scheme.
          await saveIds(updatedSyncedIds)
          await saveEntries(updatedVersions)
        }

        const result: SyncRunResult = {
          fetched: resources.length,
          mappedOk: visits.length,
          created,
          updated,
          unchanged: classified.filter((c) => c.kind === 'unchanged').length,
          skippedMapping: skipped,
          errors,
          classified,
        }

        const timestamp = runStartedAt
        await appendRun({
          timestamp,
          fetched: result.fetched,
          mappedOk: result.mappedOk,
          created,
          updated,
          unchanged: result.unchanged,
          skippedMapping: skipped.length,
          errors: errors.length,
        })

        if (errors.length > 0 && options.notifyUserGroupId) {
          await notifyOnErrors(options.notifyUserGroupId, { timestamp, fetched: result.fetched, created, updated, errors })
        }

        setLastResult(result)
        return result
      } finally {
        setRunning(false)
      }
    },
    [engine, ready, syncedIds, syncedVersions, pastRuns, saveIds, saveEntries, appendRun, notifyOnErrors],
  )

  return { running, ready, lastResult, run }
}
