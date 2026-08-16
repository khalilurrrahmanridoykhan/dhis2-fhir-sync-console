import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback, useState } from 'react'
import { classifyVisits, type Classified } from '../lib/classifySync'
import { findOrCreateProgram, submitCreateEvent, submitUpdateEvent } from '../lib/dhis2ProvisioningIO'
import { fetchImmunizationsViaRoute } from '../lib/fhirRouteFetch'
import { mapAll } from '../reused/mapping'
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
// recorded as synced). Checkpointing periodically bounds the loss to at
// most this many items instead of the whole run.
const CHECKPOINT_INTERVAL = 10

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
  lastResult: SyncRunResult | null
  run: (options: RunSyncOptions) => Promise<SyncRunResult>
}

export function useRunSync(): UseRunSyncResult {
  const engine = useDataEngine()
  const { ids: syncedIds, saveIds } = useSyncedIds()
  const { entries: syncedVersions, saveEntries } = useSyncedVersions()
  const { appendRun } = useRunHistory()
  const { notifyOnErrors } = useSyncNotifications()

  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<SyncRunResult | null>(null)

  const run = useCallback(
    async (options: RunSyncOptions): Promise<SyncRunResult> => {
      setRunning(true)
      try {
        const resources = await fetchImmunizationsViaRoute({
          routeId: options.routeId,
          fhirBaseUrl: options.fhirBaseUrl,
          pageCount: options.pageCount,
          maxPages: options.maxPages,
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
        let sinceCheckpoint = 0

        for (const item of classified) {
          if (item.kind === 'new') {
            try {
              const eventId = await submitCreateEvent(engine, provisioned, options.orgUnitId, item.visit)
              updatedSyncedIds.add(item.visit.fhirImmunizationId)
              if (item.visit.versionId) {
                updatedVersions[item.visit.fhirImmunizationId] = { versionId: item.visit.versionId, dhis2EventId: eventId }
              }
              created++
              sinceCheckpoint++
            } catch (error) {
              errors.push({ fhirImmunizationId: item.visit.fhirImmunizationId, message: error instanceof Error ? error.message : String(error) })
            }
          } else if (item.kind === 'updated') {
            try {
              await submitUpdateEvent(engine, provisioned, options.orgUnitId, item.dhis2EventId, item.visit)
              if (item.visit.versionId) {
                updatedVersions[item.visit.fhirImmunizationId] = { versionId: item.visit.versionId, dhis2EventId: item.dhis2EventId }
              }
              updated++
              sinceCheckpoint++
            } catch (error) {
              errors.push({ fhirImmunizationId: item.visit.fhirImmunizationId, message: error instanceof Error ? error.message : String(error) })
            }
          }
          // 'unchanged' -- nothing to write. If versionUnknown, there's
          // also nothing to *learn* yet (no versionId was compared against
          // anything), so updatedVersions is intentionally left untouched
          // for that case -- it'll be populated the next time this
          // resource is actually created or updated.

          if (sinceCheckpoint >= CHECKPOINT_INTERVAL) {
            await saveIds(updatedSyncedIds)
            await saveEntries(updatedVersions)
            sinceCheckpoint = 0
          }
        }

        // Final flush -- covers whatever's left under CHECKPOINT_INTERVAL,
        // and is a no-op write (same data) if the loop's last checkpoint
        // already caught everything.
        await saveIds(updatedSyncedIds)
        await saveEntries(updatedVersions)

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

        const timestamp = new Date().toISOString()
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
    [engine, syncedIds, syncedVersions, saveIds, saveEntries, appendRun, notifyOnErrors],
  )

  return { running, lastResult, run }
}
