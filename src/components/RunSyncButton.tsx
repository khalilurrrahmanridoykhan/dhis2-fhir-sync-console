import { Button, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'
import i18n from '../i18n'
import type { RunSyncOptions, UseRunSyncResult } from '../hooks/useRunSync'

interface Props {
  runSync: UseRunSyncResult
  buildOptions: () => RunSyncOptions | null
  /** Real bug found by actually looking at the running app, not by reading
   * code: this button used to have no way to tell App.tsx's own separate
   * useSyncedIds()/useRunHistory() hook instances that a real sync just
   * wrote new data. useRunSync() saves to ITS OWN internal instances of
   * those hooks (React hooks don't share state across separate calls), so
   * "Sync now" ran and persisted correctly every time, but the Run History
   * table and Total Synced count silently kept showing stale numbers until
   * a full page reload -- confirmed live: the dataStore blob was already
   * correct while the screen still showed the old values. */
  onSyncComplete: () => void
}

// A direct "sync now" path for repeat runs once you trust the mapping --
// PreviewPanel's own "Confirm and sync" is the recommended path the first
// time. Both write to the same runSync.lastResult, so the summary below
// reflects whichever one ran most recently.
export function RunSyncButton({ runSync, buildOptions, onSyncComplete }: Props) {
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    const options = buildOptions()
    if (!options) return
    setError(null)
    try {
      await runSync.run({ ...options, preview: false })
      onSyncComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const result = runSync.lastResult

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && (
        <NoticeBox error title={i18n.t('Sync failed')}>
          {error}
        </NoticeBox>
      )}
      <Button onClick={handleRun} loading={runSync.running}>
        {i18n.t('Sync now')}
      </Button>

      {result && (
        <div style={{ fontSize: 13 }}>
          {i18n.t(
            'Last run -- fetched {{fetched}}, mapped {{mapped}}, created {{created}}, updated {{updated}}, unchanged {{unchanged}}, skipped {{skipped}}, errors {{errors}}.',
            {
              fetched: result.fetched,
              mapped: result.mappedOk,
              created: result.created,
              updated: result.updated,
              unchanged: result.unchanged,
              skipped: result.skippedMapping.length,
              errors: result.errors.length,
            },
          )}
        </div>
      )}
    </div>
  )
}
