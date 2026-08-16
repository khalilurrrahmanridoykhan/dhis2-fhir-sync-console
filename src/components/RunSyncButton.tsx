import { Button, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'
import type { RunSyncOptions, UseRunSyncResult } from '../hooks/useRunSync'

interface Props {
  runSync: UseRunSyncResult
  buildOptions: () => RunSyncOptions | null
}

// A direct "sync now" path for repeat runs once you trust the mapping --
// PreviewPanel's own "Confirm and sync" is the recommended path the first
// time. Both write to the same runSync.lastResult, so the summary below
// reflects whichever one ran most recently.
export function RunSyncButton({ runSync, buildOptions }: Props) {
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    const options = buildOptions()
    if (!options) return
    setError(null)
    try {
      await runSync.run({ ...options, preview: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const result = runSync.lastResult

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && (
        <NoticeBox error title="Sync failed">
          {error}
        </NoticeBox>
      )}
      <Button onClick={handleRun} loading={runSync.running}>
        Sync now
      </Button>

      {result && (
        <div style={{ fontSize: 13 }}>
          Last run: fetched {result.fetched}, mapped {result.mappedOk}, created {result.created}, updated{' '}
          {result.updated}, unchanged {result.unchanged}, skipped {result.skippedMapping.length}, errors{' '}
          {result.errors.length}.
        </div>
      )}
    </div>
  )
}
