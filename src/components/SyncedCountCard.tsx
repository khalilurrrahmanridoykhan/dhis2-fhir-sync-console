import { CircularLoader } from '@dhis2/ui'
import i18n from '../locales'
import type { UseSyncedIdsResult } from '../hooks/useSyncedIds'
import type { UseRunHistoryResult } from '../hooks/useRunHistory'

interface Props {
  syncedIds: UseSyncedIdsResult
  runHistory: UseRunHistoryResult
}

export function SyncedCountCard({ syncedIds, runHistory }: Props) {
  const lastRun = runHistory.runs[0] ?? null

  return (
    <div style={{ border: '1px solid #dbe4ea', borderRadius: 6, padding: 16, minWidth: 180 }}>
      <div style={{ fontSize: 12, color: '#6e7a89', textTransform: 'uppercase', letterSpacing: 0.3 }}>{i18n.t('Total synced')}</div>
      {syncedIds.loading ? (
        <CircularLoader small />
      ) : (
        <div style={{ fontSize: 28, fontWeight: 700 }}>{syncedIds.ids.size}</div>
      )}
      <div style={{ fontSize: 12, color: '#6e7a89' }}>{i18n.t('Shared with the CLI bridge, if you also run that')}</div>
      <div style={{ fontSize: 12, color: '#6e7a89', marginTop: 8, borderTop: '1px solid #f0f3f5', paddingTop: 8 }}>
        {runHistory.loading
          ? i18n.t('Checking last run...')
          : lastRun
            ? i18n.t('Last synced {{when}}', { when: new Date(lastRun.timestamp).toLocaleString() })
            : i18n.t('Never synced from this console yet')}
      </div>
    </div>
  )
}
