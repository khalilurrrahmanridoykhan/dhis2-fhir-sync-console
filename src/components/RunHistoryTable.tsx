import { CircularLoader } from '@dhis2/ui'
import type { UseRunHistoryResult } from '../hooks/useRunHistory'

interface Props {
  runHistory: UseRunHistoryResult
}

export function RunHistoryTable({ runHistory }: Props) {
  if (runHistory.loading) return <CircularLoader small />

  if (runHistory.runs.length === 0) {
    return <p style={{ color: '#6e7a89', fontSize: 13 }}>No runs yet. History only covers runs triggered from this console -- the CLI bridge doesn't write here (see README).</p>
  }

  return (
    <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid #dbe4ea' }}>
          <th style={{ padding: '4px 8px' }}>When</th>
          <th style={{ padding: '4px 8px' }}>Fetched</th>
          <th style={{ padding: '4px 8px' }}>Created</th>
          <th style={{ padding: '4px 8px' }}>Updated</th>
          <th style={{ padding: '4px 8px' }}>Unchanged</th>
          <th style={{ padding: '4px 8px' }}>Skipped</th>
          <th style={{ padding: '4px 8px' }}>Errors</th>
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
  )
}
