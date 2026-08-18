import { Button, CircularLoader } from '@dhis2/ui'
import { useState } from 'react'
import i18n from '../i18n'
import type { UseRunHistoryResult } from '../hooks/useRunHistory'

interface Props {
  runHistory: UseRunHistoryResult
}

export function RunHistoryTable({ runHistory }: Props) {
  const [clearing, setClearing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (runHistory.loading) return <CircularLoader small />

  async function handleClear() {
    setClearing(true)
    try {
      await runHistory.clear()
      setConfirming(false)
    } finally {
      setClearing(false)
    }
  }

  if (runHistory.runs.length === 0) {
    return (
      <p style={{ color: '#6e7a89', fontSize: 13 }}>
        {i18n.t("No runs yet. History only covers runs triggered from this console -- the CLI bridge doesn't write here (see README).")}
      </p>
    )
  }

  return (
    <div>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #dbe4ea' }}>
            <th style={{ padding: '4px 8px' }}>{i18n.t('When')}</th>
            <th style={{ padding: '4px 8px' }}>{i18n.t('Fetched')}</th>
            <th style={{ padding: '4px 8px' }}>{i18n.t('Created')}</th>
            <th style={{ padding: '4px 8px' }}>{i18n.t('Updated')}</th>
            <th style={{ padding: '4px 8px' }}>{i18n.t('Unchanged')}</th>
            <th style={{ padding: '4px 8px' }}>{i18n.t('Skipped')}</th>
            <th style={{ padding: '4px 8px' }}>{i18n.t('Errors')}</th>
          </tr>
        </thead>
        <tbody>
          {runHistory.runs.map((run) => (
            <tr key={run.timestamp} style={{ borderBottom: '1px solid #f0f3f5' }}>
              <td style={{ padding: '4px 8px' }}>{new Date(run.timestamp).toLocaleString()}</td>
              <td style={{ padding: '4px 8px' }}>{run.fetched}</td>
              <td style={{ padding: '4px 8px' }}>{run.created}</td>
              <td style={{ padding: '4px 8px' }}>{run.updated}</td>
              <td style={{ padding: '4px 8px' }}>{run.unchanged}</td>
              <td style={{ padding: '4px 8px' }}>{run.skippedMapping}</td>
              <td style={{ padding: '4px 8px', color: run.errors > 0 ? '#c22a2a' : undefined }}>{run.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 8 }}>
        {confirming ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6e7a89' }}>
              {i18n.t('Clear this history? Already-synced resources stay synced -- this only clears the log.')}
            </span>
            <Button small destructive onClick={handleClear} loading={clearing}>
              {i18n.t('Confirm clear')}
            </Button>
            <Button small onClick={() => setConfirming(false)} disabled={clearing}>
              {i18n.t('Cancel')}
            </Button>
          </div>
        ) : (
          <Button small onClick={() => setConfirming(true)}>
            {i18n.t('Clear history')}
          </Button>
        )}
      </div>
    </div>
  )
}
