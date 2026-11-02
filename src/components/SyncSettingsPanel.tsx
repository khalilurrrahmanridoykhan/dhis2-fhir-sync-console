import { Button, CircularLoader, NoticeBox, Radio } from '@dhis2/ui'
import { useEffect, useState } from 'react'
import i18n from '../i18n'
import type { SyncType } from '../lib/fhirGatewayClient'
import type { ScheduleMode, ScheduleView } from '../lib/scheduleClient'
import type { UseScheduleResult } from '../hooks/useSchedule'

interface Props {
  schedule: UseScheduleResult
}

export function SyncSettingsPanel({ schedule }: Props) {
  if (schedule.loading) return <CircularLoader small />

  const typeLabels: { type: SyncType; label: string }[] = [
    { type: 'immunization-to-fhir', label: i18n.t('Immunization: DHIS2 → FHIR') },
    { type: 'immunization-to-dhis2', label: i18n.t('Immunization: FHIR → DHIS2') },
    { type: 'org-units-to-fhir', label: i18n.t('Metadata: Organisation units') },
    { type: 'option-sets-to-fhir', label: i18n.t('Metadata: Option sets') },
    { type: 'tracked-entities-to-fhir', label: i18n.t('Metadata: Tracked entities') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {schedule.error && (
        <NoticeBox error title={i18n.t('Schedule error')}>
          {schedule.error}
        </NoticeBox>
      )}

      {typeLabels.map(({ type, label }) => {
        const view = schedule.schedules.find((s) => s.syncType === type)
        if (!view) return null
        return <ScheduleSection key={type} type={type} label={label} view={view} schedule={schedule} />
      })}
    </div>
  )
}

function ScheduleSection({
  type,
  label,
  view,
  schedule,
}: {
  type: SyncType
  label: string
  view: ScheduleView
  schedule: UseScheduleResult
}) {
  const [draftMode, setDraftMode] = useState<ScheduleMode>(view.mode)
  const [draftInterval, setDraftInterval] = useState(String(view.intervalHours))
  const [oneTimeValue, setOneTimeValue] = useState('')

  // Picks up the server's confirmed value after a save, without clobbering in-progress
  // edits on every unrelated re-render (this effect only fires when the server value
  // itself actually changes).
  useEffect(() => {
    setDraftMode(view.mode)
    setDraftInterval(String(view.intervalHours))
  }, [view.mode, view.intervalHours])

  const saving = schedule.saving === type
  const dirty = draftMode !== view.mode || Number(draftInterval) !== view.intervalHours

  return (
    <section style={{ border: '1px solid #dbe4ea', borderRadius: 6, padding: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>{label}</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        <Radio label={i18n.t('Automatic')} checked={draftMode === 'AUTOMATIC'} onChange={() => setDraftMode('AUTOMATIC')} />
        <Radio label={i18n.t('Manual only')} checked={draftMode === 'MANUAL'} onChange={() => setDraftMode('MANUAL')} />
      </div>

      {draftMode === 'AUTOMATIC' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <label style={{ fontSize: 13 }}>{i18n.t('Run every')}</label>
          <input
            type="number"
            min={1}
            value={draftInterval}
            onChange={(e) => setDraftInterval(e.target.value)}
            style={{ width: 60, padding: 4, border: '1px solid #dbe4ea', borderRadius: 4 }}
          />
          <label style={{ fontSize: 13 }}>{i18n.t('hour(s)')}</label>
        </div>
      )}

      <Button
        small
        primary
        disabled={!dirty || (draftMode === 'AUTOMATIC' && Number(draftInterval) < 1)}
        loading={saving}
        onClick={() => schedule.save(type, draftMode, Number(draftInterval) || 1)}
      >
        {i18n.t('Save')}
      </Button>

      <p style={{ fontSize: 12, color: '#6e7a89', marginTop: 8 }}>
        {view.lastRunAt
          ? i18n.t('Last ran: {{when}}', { when: new Date(view.lastRunAt).toLocaleString() })
          : i18n.t('Never run yet.')}
      </p>

      <div style={{ borderTop: '1px solid #f0f3f5', marginTop: 12, paddingTop: 12 }}>
        <label style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{i18n.t('Run once at a specific time')}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="datetime-local"
            value={oneTimeValue}
            onChange={(e) => setOneTimeValue(e.target.value)}
            style={{ padding: 4, border: '1px solid #dbe4ea', borderRadius: 4 }}
          />
          <Button
            small
            disabled={!oneTimeValue}
            loading={saving}
            onClick={() => schedule.runAt(type, new Date(oneTimeValue).toISOString())}
          >
            {i18n.t('Schedule')}
          </Button>
        </div>

        {view.pendingOneTimeRunAt && (
          <p style={{ fontSize: 12, marginTop: 8 }}>
            {i18n.t('Scheduled for {{when}}', { when: new Date(view.pendingOneTimeRunAt).toLocaleString() })}{' '}
            <Button small destructive onClick={() => schedule.cancelRunAt(type)}>
              {i18n.t('Cancel')}
            </Button>
          </p>
        )}
      </div>
    </section>
  )
}
