import { CircularLoader } from '@dhis2/ui'
import type { UseSyncedIdsResult } from '../hooks/useSyncedIds'

interface Props {
  syncedIds: UseSyncedIdsResult
}

export function SyncedCountCard({ syncedIds }: Props) {
  return (
    <div style={{ border: '1px solid #dbe4ea', borderRadius: 6, padding: 16, minWidth: 180 }}>
      <div style={{ fontSize: 12, color: '#6e7a89', textTransform: 'uppercase', letterSpacing: 0.3 }}>Total synced</div>
      {syncedIds.loading ? (
        <CircularLoader small />
      ) : (
        <div style={{ fontSize: 28, fontWeight: 700 }}>{syncedIds.ids.size}</div>
      )}
      <div style={{ fontSize: 12, color: '#6e7a89' }}>Shared with the CLI bridge, if you also run that</div>
    </div>
  )
}
