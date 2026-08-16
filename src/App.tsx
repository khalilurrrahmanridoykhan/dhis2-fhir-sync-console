import { CircularLoader, HeaderBar } from '@dhis2/ui'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PreviewPanel } from './components/PreviewPanel'
import { RunErrorsPanel } from './components/RunErrorsPanel'
import { RunHistoryTable } from './components/RunHistoryTable'
import { RunSyncButton } from './components/RunSyncButton'
import { SettingsForm } from './components/SettingsForm'
import { SyncedCountCard } from './components/SyncedCountCard'
import { useCurrentUserAuthorities } from './hooks/useCurrentUserAuthorities'
import { useFhirRoute } from './hooks/useFhirRoute'
import { useIsStandalone } from './hooks/useIsStandalone'
import { useRunHistory } from './hooks/useRunHistory'
import { useRunSync, type RunSyncOptions } from './hooks/useRunSync'
import { useSettings } from './hooks/useSettings'
import { useSyncedIds } from './hooks/useSyncedIds'

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

function AppContent() {
  const isStandalone = useIsStandalone()
  const authorities = useCurrentUserAuthorities()
  const { settings, loading: settingsLoading, saveSettings } = useSettings()
  const fhirRoute = useFhirRoute()
  const syncedIds = useSyncedIds()
  const runHistory = useRunHistory()
  const runSync = useRunSync()

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
      <>
        {isStandalone && <HeaderBar appName="FHIR Sync Console" />}
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <CircularLoader />
        </div>
      </>
    )
  }

  const ready = Boolean(settings.routeId && settings.orgUnitId)

  return (
    <>
      {isStandalone && <HeaderBar appName="FHIR Sync Console" />}
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <section>
          <h2>Settings</h2>
          <SettingsForm settings={settings} onSave={saveSettings} authorities={authorities} fhirRoute={fhirRoute} />
        </section>

        {ready && (
          <>
            <section style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <SyncedCountCard syncedIds={syncedIds} runHistory={runHistory} />
              <div style={{ flex: 1 }}>
                <h2>Sync</h2>
                <PreviewPanel runSync={runSync} buildOptions={buildOptions} onConfirmed={() => runHistory.refresh()} />
                <div style={{ marginTop: 16 }}>
                  <RunSyncButton runSync={runSync} buildOptions={buildOptions} />
                </div>
                <div style={{ marginTop: 16 }}>
                  <RunErrorsPanel runSync={runSync} />
                </div>
              </div>
            </section>

            <section>
              <h2>Run history</h2>
              <RunHistoryTable runHistory={runHistory} />
            </section>
          </>
        )}

        {!ready && (
          <p style={{ color: '#6e7a89' }}>Pick a FHIR route and a target organisation unit above before syncing.</p>
        )}
      </div>
    </>
  )
}
