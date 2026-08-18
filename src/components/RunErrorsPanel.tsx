import { NoticeBox } from '@dhis2/ui'
import i18n from '../locales'
import type { UseRunSyncResult } from '../hooks/useRunSync'

interface Props {
  runSync: UseRunSyncResult
}

// Per-resource error detail, not just a count. A failed resource is never
// recorded as synced (see useRunSync.ts), so re-running "Preview sync" or
// "Sync now" naturally retries exactly the resources that failed -- no
// separate per-resource retry mechanism is needed for that reason.
export function RunErrorsPanel({ runSync }: Props) {
  const errors = runSync.lastResult?.errors ?? []

  if (errors.length === 0) return null

  return (
    <div style={{ border: '1px solid #e8b4b4', borderRadius: 6, padding: 16 }}>
      <h4 style={{ margin: '0 0 8px' }}>{i18n.t('Errors from the last run ({{count}})', { count: errors.length })}</h4>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {errors.map((e) => (
          <li key={e.fhirImmunizationId} style={{ marginBottom: 8 }}>
            <strong>{e.fhirImmunizationId}</strong> -- {e.message}
          </li>
        ))}
      </ul>
      <NoticeBox title={i18n.t('To retry')}>
        {i18n.t(
          'Run "Preview sync" or "Sync now" again -- a resource that failed was never recorded as synced, so it\'s picked up and retried automatically on the next run.',
        )}
      </NoticeBox>
    </div>
  )
}
