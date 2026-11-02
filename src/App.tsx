import { CircularLoader } from '@dhis2/ui'
import { useEffect, useRef, useState } from 'react'
import { AppShell, type TabId } from './components/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import {
  GatewayHistoryTable,
  ImmunizationDhis2ToFhirPanel,
  ImmunizationFhirToDhis2Panel,
  OptionSetsGatewayPanel,
  OrgUnitsGatewayPanel,
  TrackedEntitiesGatewayPanel,
} from './components/FhirGatewayPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { RunErrorsPanel } from './components/RunErrorsPanel'
import { RunHistoryTable } from './components/RunHistoryTable'
import { RunSyncButton } from './components/RunSyncButton'
import { SettingsWizard } from './components/SettingsForm'
import { SyncedCountCard } from './components/SyncedCountCard'
import { SyncSettingsPanel } from './components/SyncSettingsPanel'
import { useCurrentUserAuthorities } from './hooks/useCurrentUserAuthorities'
import { useFhirGateway } from './hooks/useFhirGateway'
import { useFhirRoute } from './hooks/useFhirRoute'
import { useRunHistory } from './hooks/useRunHistory'
import { useRunSync, type RunSyncOptions } from './hooks/useRunSync'
import { useSchedule } from './hooks/useSchedule'
import { useSettings } from './hooks/useSettings'
import { useSettingsWizard } from './hooks/useSettingsWizard'
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
  const [activeTab, setActiveTab] = useState<TabId>('sync')
  const authorities = useCurrentUserAuthorities()
  const { settings, loading: settingsLoading, saveSettings } = useSettings()
  const fhirRoute = useFhirRoute()
  const syncedIds = useSyncedIds()
  const runHistory = useRunHistory()
  const runSync = useRunSync()
  const fhirGateway = useFhirGateway(settings.gatewayRouteId)
  const schedule = useSchedule(settings.gatewayRouteId)
  const wizard = useSettingsWizard(settings, saveSettings)

  const settingsComplete = Boolean(settings.routeId && settings.gatewayRouteId && settings.orgUnitId)

  // First-time (or not-yet-configured) visitors land straight on Settings instead
  // of a Sync tab full of disabled buttons -- but only once, so navigating away
  // afterwards (even before finishing) never gets fought.
  const defaultedToSettings = useRef(false)
  useEffect(() => {
    if (!settingsLoading && !settingsComplete && !defaultedToSettings.current) {
      defaultedToSettings.current = true
      setActiveTab('settings')
    }
  }, [settingsLoading, settingsComplete])

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

  const settingsSteps = [
    { label: i18n.t('Route setup'), unlocked: true },
    { label: i18n.t('Organisation unit & paging'), unlocked: wizard.maxStepReached >= 1 },
    { label: i18n.t('Notifications'), unlocked: wizard.maxStepReached >= 2 },
  ]

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      tabsEnabled={settingsComplete}
      settingsSteps={activeTab === 'settings' ? settingsSteps : undefined}
      activeSettingsStep={wizard.step}
      onSelectSettingsStep={wizard.goToStep}
      onBackToApp={() => setActiveTab('sync')}
    >
      {activeTab === 'sync' && (
        <section>
          <h2>{i18n.t('Sync')}</h2>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <SyncedCountCard syncedIds={syncedIds} runHistory={runHistory} />
            <div style={{ flex: 1 }}>
              <PreviewPanel runSync={runSync} buildOptions={buildOptions} onSyncComplete={handleSyncComplete} />
              <div style={{ marginTop: 16 }}>
                <RunSyncButton runSync={runSync} buildOptions={buildOptions} onSyncComplete={handleSyncComplete} />
              </div>
              <div style={{ marginTop: 16 }}>
                <RunErrorsPanel runSync={runSync} />
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'immunization-d2f' && (
        <section>
          <h2>{i18n.t('Immunization: DHIS2 → FHIR')}</h2>
          <ImmunizationDhis2ToFhirPanel gateway={fhirGateway} />
        </section>
      )}

      {activeTab === 'immunization-f2d' && (
        <section>
          <h2>{i18n.t('Immunization: FHIR → DHIS2')}</h2>
          <ImmunizationFhirToDhis2Panel gateway={fhirGateway} />
        </section>
      )}

      {activeTab === 'metadata-orgunits' && (
        <section>
          <h2>{i18n.t('Metadata: Organisation units')}</h2>
          <OrgUnitsGatewayPanel gateway={fhirGateway} />
        </section>
      )}

      {activeTab === 'metadata-optionsets' && (
        <section>
          <h2>{i18n.t('Metadata: Option sets')}</h2>
          <OptionSetsGatewayPanel gateway={fhirGateway} />
        </section>
      )}

      {activeTab === 'metadata-trackedentities' && (
        <section>
          <h2>{i18n.t('Metadata: Tracked entities')}</h2>
          <TrackedEntitiesGatewayPanel gateway={fhirGateway} />
        </section>
      )}

      {activeTab === 'history' && (
        <section>
          <h2>{i18n.t('Run history')}</h2>

          <h3 style={{ fontSize: 14 }}>{i18n.t('FHIR-route sync (Sync tab)')}</h3>
          <RunHistoryTable runHistory={runHistory} />

          <h3 style={{ fontSize: 14, marginTop: 24 }}>{i18n.t('Gateway sync (all types)')}</h3>
          <GatewayHistoryTable gateway={fhirGateway} historyFilter={() => true} showType />
        </section>
      )}

      {activeTab === 'sync-settings' && (
        <section>
          <h2>{i18n.t('Sync settings')}</h2>
          <p style={{ color: '#6e7a89', fontSize: 13 }}>
            {i18n.t(
              'Per sync type: run automatically every N hours, or manual-only (trigger only from its own tab). A one-time run can also be scheduled for a specific date and time regardless of mode.',
            )}
          </p>
          <SyncSettingsPanel schedule={schedule} />
        </section>
      )}

      {activeTab === 'settings' && (
        <section>
          <h2>{i18n.t('Settings')}</h2>
          <SettingsWizard wizard={wizard} authorities={authorities} fhirRoute={fhirRoute} />
        </section>
      )}
    </AppShell>
  )
}
