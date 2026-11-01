import { Button, CircularLoader, NoticeBox } from '@dhis2/ui'
import i18n from '../i18n'
import type { UseFhirGatewayResult } from '../hooks/useFhirGateway'

interface Props {
  gateway: UseFhirGatewayResult
}

export function FhirGatewayPanel({ gateway }: Props) {
  const busy = gateway.triggering !== null

  return (
    <div>
      <p style={{ color: '#6e7a89', fontSize: 13 }}>
        {i18n.t(
          'Runs via the standalone Java/Camel service -- separate from the FHIR-route sync above, and separate from DHIS2 itself.',
        )}
      </p>

      <h3 style={{ fontSize: 14, marginBottom: 4 }}>{i18n.t('Immunization (two-way)')}</h3>
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

      <h3 style={{ fontSize: 14, marginTop: 16, marginBottom: 4 }}>{i18n.t('Metadata (DHIS2 → FHIR only)')}</h3>
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
      <p style={{ color: '#6e7a89', fontSize: 12, marginTop: 4 }}>
        {i18n.t(
          'Tracked entities still uses a legacy DHIS2 API and fails against current DHIS2 versions -- a known, unfixed gap, not a new bug.',
        )}
      </p>
      <p style={{ color: '#6e7a89', fontSize: 12 }}>
        {i18n.t('Metadata runs are not yet recorded in the history table below -- only Immunization runs are.')}
      </p>

      {gateway.error && (
        <div style={{ marginTop: 8 }}>
          <NoticeBox error title={i18n.t('Gateway error')}>
            {gateway.error}
          </NoticeBox>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {gateway.loading ? (
          <CircularLoader small />
        ) : gateway.history.length === 0 ? (
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
              {gateway.history.map((entry) => (
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
    </div>
  )
}
