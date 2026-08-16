import { Button, NoticeBox } from '@dhis2/ui'
import { useState } from 'react'
import type { RunSyncOptions, SyncRunResult, UseRunSyncResult } from '../hooks/useRunSync'

interface Props {
  runSync: UseRunSyncResult
  buildOptions: () => RunSyncOptions | null
  /** Called after a real (non-preview) run completes -- lets App.tsx refresh
   * its own separate useSyncedIds()/useRunHistory() hook instances, which
   * don't otherwise learn that useRunSync() (a different instance of those
   * same hooks) just wrote new data. See the identical note on
   * RunSyncButton's onSyncComplete for how this was actually found. */
  onSyncComplete: () => void
}

const KIND_LABEL: Record<string, string> = {
  new: 'New',
  updated: 'Updated',
  unchanged: 'Unchanged',
}

export function PreviewPanel({ runSync, buildOptions, onSyncComplete }: Props) {
  const [preview, setPreview] = useState<SyncRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function handlePreview() {
    const options = buildOptions()
    if (!options) return
    setError(null)
    setPreview(null)
    try {
      const result = await runSync.run({ ...options, preview: true })
      setPreview(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleConfirm() {
    const options = buildOptions()
    if (!options) return
    setConfirming(true)
    setError(null)
    try {
      await runSync.run({ ...options, preview: false })
      setPreview(null)
      onSyncComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && (
        <NoticeBox error title="Preview failed">
          {error}
        </NoticeBox>
      )}

      <Button onClick={handlePreview} loading={runSync.running && !preview}>
        Preview sync
      </Button>

      {preview && (
        <div style={{ border: '1px solid #dbe4ea', borderRadius: 6, padding: 16 }}>
          <p style={{ marginTop: 0 }}>
            Fetched <strong>{preview.fetched}</strong>, mapped <strong>{preview.mappedOk}</strong>. Would create{' '}
            <strong>{preview.classified.filter((c) => c.kind === 'new').length}</strong>, update{' '}
            <strong>{preview.classified.filter((c) => c.kind === 'updated').length}</strong>, leave{' '}
            <strong>{preview.unchanged}</strong> unchanged, and skip <strong>{preview.skippedMapping.length}</strong> unmappable.
          </p>

          {preview.classified.length > 0 && (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #dbe4ea' }}>
                    <th style={{ padding: '4px 8px' }}>FHIR id</th>
                    <th style={{ padding: '4px 8px' }}>Antigen</th>
                    <th style={{ padding: '4px 8px' }}>Classification</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.classified.map((item) => (
                    <tr key={item.visit.fhirImmunizationId} style={{ borderBottom: '1px solid #f0f3f5' }}>
                      <td style={{ padding: '4px 8px' }}>{item.visit.fhirImmunizationId}</td>
                      <td style={{ padding: '4px 8px' }}>{item.visit.antigenName}</td>
                      <td style={{ padding: '4px 8px' }}>
                        {KIND_LABEL[item.kind]}
                        {item.kind === 'unchanged' && item.versionUnknown ? ' (version unknown -- synced elsewhere)' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.skippedMapping.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>Unmappable:</strong>
              <ul>
                {preview.skippedMapping.map((s) => (
                  <li key={s.fhirImmunizationId}>
                    {s.fhirImmunizationId}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <Button primary onClick={handleConfirm} loading={confirming}>
              Confirm and sync
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
