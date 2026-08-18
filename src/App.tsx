import { CircularLoader } from '@dhis2/ui'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PreviewPanel } from './components/PreviewPanel'
import { RunErrorsPanel } from './components/RunErrorsPanel'
import { RunHistoryTable } from './components/RunHistoryTable'
import { RunSyncButton } from './components/RunSyncButton'
import { SettingsForm } from './components/SettingsForm'
import { SyncedCountCard } from './components/SyncedCountCard'
import { useCurrentUserAuthorities } from './hooks/useCurrentUserAuthorities'
import { useFhirRoute } from './hooks/useFhirRoute'
import { useRunHistory } from './hooks/useRunHistory'
import { useRunSync, type RunSyncOptions } from './hooks/useRunSync'
import { useSettings } from './hooks/useSettings'
import { useSyncedIds } from './hooks/useSyncedIds'
import i18n from './i18n'

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

function AppContent() {
  const authorities = useCurrentUserAuthorities()
  const { settings, loading: settingsLoading, saveSettings } = useSettings()
  const fhirRoute = useFhirRoute()
  const syncedIds = useSyncedIds()
  const runHistory = useRunHistory()
  const runSync = useRunSync()

  // useRunSync() keeps its own separate useSyncedIds()/useRunHistory()
  // instances internally -- after a real run, THIS handler is what tells
  // the display-only instances here to catch up. See the header comments on
  // RunSyncButton/PreviewPanel's onSyncComplete for how this gap was found.
  function handleSyncComplete() {
    runHistory.refresh()
    syncedIds.refresh()
  }

  function buildOptions(): RunSyncOptions | null {
    if (!settings.routeId || !settings.orgUnitId) return null
    const route = fhirRoute.wildcardRoutes.find((r) => r.id === settings.routeId)
    if (!route) return null
    return {
      routeId: settings.routeId,
      fhirBaseUrl: route.url.replace(/\/\*\*$/, ''),
      orgUnitId: settings.orgUnitId,
      pageCount: settings.pageCount,
      maxPages: settings.maxPages,
      notifyUserGroupId: settings.notifyUserGroupId,
      preview: false,
    }
  }

  if (settingsLoading || authorities.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <CircularLoader />
      </div>
    )
  }

  const ready = Boolean(settings.routeId && settings.orgUnitId)

  return (
    <>
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <section>
          <h2>{i18n.t('Settings')}</h2>
          <SettingsForm settings={settings} onSave={saveSettings} authorities={authorities} fhirRoute={fhirRoute} />
        </section>

        {ready && (
          <>
            <section style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <SyncedCountCard syncedIds={syncedIds} runHistory={runHistory} />
              <div style={{ flex: 1 }}>
                <h2>{i18n.t('Sync')}</h2>
                <PreviewPanel runSync={runSync} buildOptions={buildOptions} onSyncComplete={handleSyncComplete} />
                <div style={{ marginTop: 16 }}>
                  <RunSyncButton runSync={runSync} buildOptions={buildOptions} onSyncComplete={handleSyncComplete} />
                </div>
                <div style={{ marginTop: 16 }}>
                  <RunErrorsPanel runSync={runSync} />
                </div>
              </div>
            </section>

            <section>
              <h2>{i18n.t('Run history')}</h2>
              <RunHistoryTable runHistory={runHistory} />
            </section>
          </>
        )}

        {!ready && (
          <p style={{ color: '#6e7a89' }}>{i18n.t('Pick a FHIR route and a target organisation unit above before syncing.')}</p>
        )}
      </div>
    </>
  )
}
