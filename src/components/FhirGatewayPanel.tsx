import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import i18n from '../i18n'
import type { GatewaySyncLogEntry } from '../lib/fhirGatewayClient'
import type { UseFhirGatewayResult } from '../hooks/useFhirGateway'

interface Props {
  gateway: UseFhirGatewayResult
}

export function ImmunizationGatewayPanel({ gateway }: Props) {
  const busy = gateway.triggering !== null

  return (
    <div>
      <p style={{ color: '#6e7a89', fontSize: 13 }}>
        {i18n.t(
          'Two-way sync for the Immunization resource type only, via the standalone Java/Camel service -- separate from the FHIR-route sync and from DHIS2 itself.',
        )}
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          small
          loading={gateway.triggering === 'immunization-to-fhir'}
          disabled={busy}
          onClick={() => gateway.trigger('immunization-to-fhir')}
        >
          {i18n.t('Sync DHIS2 → FHIR')}
        </Button>
        <Button
          small
          loading={gateway.triggering === 'immunization-to-dhis2'}
          disabled={busy}
          onClick={() => gateway.trigger('immunization-to-dhis2')}
        >
          {i18n.t('Sync FHIR → DHIS2')}
        </Button>
      </div>

      <GatewayError gateway={gateway} />
      <GatewayHistoryTable gateway={gateway} syncTypes={['immunization']} />
    </div>
  )
}

export function MetadataGatewayPanel({ gateway }: Props) {
  const busy = gateway.triggering !== null

  return (
    <div>
      <p style={{ color: '#6e7a89', fontSize: 13 }}>
        {i18n.t(
          'One-way, DHIS2 → FHIR only, via the standalone Java/Camel service. The reverse direction for metadata is out of scope by design -- see the project plan.',
        )}
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          small
          loading={gateway.triggering === 'org-units-to-fhir'}
          disabled={busy}
          onClick={() => gateway.trigger('org-units-to-fhir')}
        >
          {i18n.t('Sync organisation units')}
        </Button>
        <Button
          small
          loading={gateway.triggering === 'option-sets-to-fhir'}
          disabled={busy}
          onClick={() => gateway.trigger('option-sets-to-fhir')}
        >
          {i18n.t('Sync option sets')}
        </Button>
        <Button
          small
          loading={gateway.triggering === 'tracked-entities-to-fhir'}
          disabled={busy}
          onClick={() => gateway.trigger('tracked-entities-to-fhir')}
        >
          {i18n.t('Sync tracked entities')}
        </Button>
      </div>

      <GatewayError gateway={gateway} />
      <GatewayHistoryTable gateway={gateway} syncTypes={['org-unit', 'option-set', 'tracked-entity']} />
    </div>
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

// Filters the shared gateway history down to the syncType(s) relevant to this tab --
// see GatewaySyncLogEntry.syncType for why "direction" alone can't do this split.
function GatewayHistoryTable({ gateway, syncTypes }: Props & { syncTypes: GatewaySyncLogEntry['syncType'][] }) {
  const entries = gateway.history.filter((entry) => syncTypes.includes(entry.syncType))

  return (
    <div style={{ marginTop: 16 }}>
      {gateway.loading ? (
        <CircularLoader small />
      ) : entries.length === 0 ? (
        <p style={{ color: '#6e7a89', fontSize: 13 }}>{i18n.t('No gateway sync runs yet.')}</p>
      ) : (
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #dbe4ea' }}>
              <th style={{ padding: '4px 8px' }}>{i18n.t('When')}</th>
              <th style={{ padding: '4px 8px' }}>{i18n.t('Direction')}</th>
              <th style={{ padding: '4px 8px' }}>{i18n.t('Source')}</th>
              <th style={{ padding: '4px 8px' }}>{i18n.t('Action')}</th>
              <th style={{ padding: '4px 8px' }}>{i18n.t('Detail')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: '1px solid #f0f3f5' }}>
                <td style={{ padding: '4px 8px' }}>{new Date(entry.timestamp).toLocaleString()}</td>
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
      )}
    </div>
  )
}
