import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import i18n from '../i18n'
import type { GatewaySyncLogEntry, SyncType } from '../lib/fhirGatewayClient'
import type { UseFhirGatewayResult } from '../hooks/useFhirGateway'
import { usePagination } from '../hooks/usePagination'
import { PaginationBar } from './PaginationBar'

interface Props {
  gateway: UseFhirGatewayResult
}

interface GatewaySyncPanelProps extends Props {
  description: string
  syncType: SyncType
  buttonLabel: string
  historyFilter: (entry: GatewaySyncLogEntry) => boolean
}

// One sync type, one tab: Preview + trigger buttons, a preview result table (read-only --
// see PreviewController.java, never writes to DHIS2/FHIR), and the history filtered down
// to just this type (and, for the two Immunization directions, just that direction -- both
// share syncType "immunization" but differ in GatewaySyncLogEntry.direction).
function GatewaySyncPanel({ gateway, description, syncType, buttonLabel, historyFilter }: GatewaySyncPanelProps) {
  const busy = gateway.triggering !== null || gateway.previewing !== null

  return (
    <div>
      <p style={{ color: '#6e7a89', fontSize: 13 }}>{description}</p>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button small loading={gateway.previewing === syncType} disabled={busy} onClick={() => gateway.preview(syncType)}>
          {i18n.t('Preview')}
        </Button>
        <Button small primary loading={gateway.triggering === syncType} disabled={busy} onClick={() => gateway.trigger(syncType)}>
          {buttonLabel}
        </Button>
      </div>

      <GatewayError gateway={gateway} />
      <GatewayPreviewTable gateway={gateway} syncType={syncType} />
      <GatewayHistoryTable gateway={gateway} historyFilter={historyFilter} />
    </div>
  )
}

function GatewayPreviewTable({ gateway, syncType }: Props & { syncType: SyncType }) {
  const entries = gateway.previews[syncType] ?? []
  const pagination = usePagination(entries, 20)
  const previews = gateway.previews[syncType]
  if (!previews) return null

  return (
    <div style={{ marginTop: 16, border: '1px solid #dbe4ea', borderRadius: 6, padding: 16 }}>
      <p style={{ marginTop: 0, fontWeight: 500 }}>
        {i18n.t('Preview -- nothing written yet ({{count}} items)', { count: entries.length })}
      </p>
      {entries.length === 0 ? (
        <p style={{ color: '#6e7a89', fontSize: 13 }}>{i18n.t('Nothing to sync.')}</p>
      ) : (
        <>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #dbe4ea' }}>
                <th style={{ padding: '4px 8px' }}>{i18n.t('Source')}</th>
                <th style={{ padding: '4px 8px' }}>{i18n.t('Would do')}</th>
                <th style={{ padding: '4px 8px' }}>{i18n.t('Detail')}</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((entry, index) => (
                <tr key={`${entry.sourceId}-${index}`} style={{ borderBottom: '1px solid #f0f3f5' }}>
                  <td style={{ padding: '4px 8px' }}>{entry.sourceId}</td>
                  <td style={{ padding: '4px 8px', color: entry.action.startsWith('skipped') ? '#6e7a89' : undefined }}>
                    {entry.action}
                  </td>
                  <td style={{ padding: '4px 8px' }}>{entry.message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar pagination={pagination} />
        </>
      )}
    </div>
  )
}

export function ImmunizationDhis2ToFhirPanel({ gateway }: Props) {
  return (
    <GatewaySyncPanel
      gateway={gateway}
      description={i18n.t(
        'DHIS2 vaccination events → FHIR Immunization, via the standalone Java/Camel service -- one half of the two-way Immunization sync.',
      )}
      syncType="immunization-to-fhir"
      buttonLabel={i18n.t('Sync DHIS2 → FHIR')}
      historyFilter={(e) => e.syncType === 'immunization' && e.direction === 'dhis2-to-fhir'}
    />
  )
}

export function ImmunizationFhirToDhis2Panel({ gateway }: Props) {
  return (
    <GatewaySyncPanel
      gateway={gateway}
      description={i18n.t(
        'FHIR Immunization → DHIS2 vaccination events, via the standalone Java/Camel service -- the other half of the two-way Immunization sync. Origin-tagged entries this same service already produced are skipped, to avoid a sync loop.',
      )}
      syncType="immunization-to-dhis2"
      buttonLabel={i18n.t('Sync FHIR → DHIS2')}
      historyFilter={(e) => e.syncType === 'immunization' && e.direction === 'fhir-to-dhis2'}
    />
  )
}

export function OrgUnitsGatewayPanel({ gateway }: Props) {
  return (
    <GatewaySyncPanel
      gateway={gateway}
      description={i18n.t(
        'DHIS2 organisation units → FHIR Organization/Location, via the standalone Java/Camel service. One-way, DHIS2 → FHIR only, by design.',
      )}
      syncType="org-units-to-fhir"
      buttonLabel={i18n.t('Sync organisation units')}
      historyFilter={(e) => e.syncType === 'org-unit'}
    />
  )
}

export function OptionSetsGatewayPanel({ gateway }: Props) {
  return (
    <GatewaySyncPanel
      gateway={gateway}
      description={i18n.t(
        'DHIS2 option sets → FHIR CodeSystem/ValueSet, via the standalone Java/Camel service. One-way, DHIS2 → FHIR only, by design.',
      )}
      syncType="option-sets-to-fhir"
      buttonLabel={i18n.t('Sync option sets')}
      historyFilter={(e) => e.syncType === 'option-set'}
    />
  )
}

export function TrackedEntitiesGatewayPanel({ gateway }: Props) {
  return (
    <GatewaySyncPanel
      gateway={gateway}
      description={i18n.t(
        'DHIS2 tracked entities → FHIR Patient, via the standalone Java/Camel service. One-way, DHIS2 → FHIR only, by design.',
      )}
      syncType="tracked-entities-to-fhir"
      buttonLabel={i18n.t('Sync tracked entities')}
      historyFilter={(e) => e.syncType === 'tracked-entity'}
    />
  )
}

function GatewayError({ gateway }: Props) {
  if (!gateway.error) return null
  return (
    <div style={{ marginTop: 8 }}>
      <NoticeBox error title={i18n.t('Gateway error')}>
        {gateway.error}
      </NoticeBox>
    </div>
  )
}

export function GatewayHistoryTable({
  gateway,
  historyFilter,
  showType = false,
}: Props & { historyFilter: (entry: GatewaySyncLogEntry) => boolean; showType?: boolean }) {
  const entries = gateway.history.filter(historyFilter)
  const pagination = usePagination(entries, 20)

  return (
    <div style={{ marginTop: 16 }}>
      {gateway.loading ? (
        <CircularLoader small />
      ) : entries.length === 0 ? (
        <p style={{ color: '#6e7a89', fontSize: 13 }}>{i18n.t('No gateway sync runs yet.')}</p>
      ) : (
        <>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #dbe4ea' }}>
                <th style={{ padding: '4px 8px' }}>{i18n.t('When')}</th>
                {showType && <th style={{ padding: '4px 8px' }}>{i18n.t('Type')}</th>}
                <th style={{ padding: '4px 8px' }}>{i18n.t('Direction')}</th>
                <th style={{ padding: '4px 8px' }}>{i18n.t('Source')}</th>
                <th style={{ padding: '4px 8px' }}>{i18n.t('Action')}</th>
                <th style={{ padding: '4px 8px' }}>{i18n.t('Detail')}</th>
              </tr>
            </thead>
            <tbody>
              {pagination.pageItems.map((entry) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid #f0f3f5' }}>
                  <td style={{ padding: '4px 8px' }}>{new Date(entry.timestamp).toLocaleString()}</td>
                  {showType && <td style={{ padding: '4px 8px' }}>{entry.syncType}</td>}
                  <td style={{ padding: '4px 8px' }}>{entry.direction}</td>
                  <td style={{ padding: '4px 8px' }}>{entry.sourceId}</td>
                  <td style={{ padding: '4px 8px', color: entry.action.startsWith('skipped') ? '#6e7a89' : undefined }}>
                    {entry.action}
                  </td>
                  <td style={{ padding: '4px 8px' }}>{entry.message ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar pagination={pagination} />
        </>
      )}
    </div>
  )
}
