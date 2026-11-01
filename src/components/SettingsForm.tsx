import { useDataQuery } from '@dhis2/app-runtime'
import {
  Button,
  CircularLoader,
  IconAdd16,
  InputField,
  NoticeBox,
  OrganisationUnitTree,
  SingleSelectField,
  SingleSelectOption,
} from '@dhis2/ui'
import { useState } from 'react'
import type { UseFhirRouteResult } from '../hooks/useFhirRoute'
import type { CurrentUserAuthorities } from '../hooks/useCurrentUserAuthorities'
import type { UseSettingsWizardResult } from '../hooks/useSettingsWizard'
import i18n from '../i18n'
import { RouteCreateModal } from './RouteCreateModal'

const orgUnitRootsQuery = {
  roots: { resource: 'organisationUnits', params: { filter: 'level:eq:1', fields: 'id', paging: 'false' } },
}
const userGroupsQuery = {
  groups: { resource: 'userGroups', params: { fields: 'id,displayName', paging: 'false' } },
}

const PAGE_COUNT_RANGE = { min: 1, max: 200 }
const MAX_PAGES_RANGE = { min: 1, max: 1000 }

interface OrgUnitRootsResponse {
  roots: { organisationUnits: { id: string }[] }
}
interface UserGroupsResponse {
  groups: { userGroups: { id: string; displayName: string }[] }
}

interface Props {
  wizard: UseSettingsWizardResult
  authorities: CurrentUserAuthorities
  fhirRoute: UseFhirRouteResult
}

// Three-step wizard (Route setup -> Organisation unit & paging -> Notifications),
// each step gated on the previous one's validity -- see useSettingsWizard. The
// secondary sidebar in AppShell drives the SAME step state (lifted up to App.tsx),
// so clicking a sidebar item here and clicking "Next" below stay in sync.
export function SettingsWizard({ wizard, authorities, fhirRoute }: Props) {
  return (
    <div style={{ maxWidth: 640 }}>
      {wizard.saveError && (
        <div style={{ marginBottom: 16 }}>
          <NoticeBox error title={i18n.t('Could not save settings')}>
            {wizard.saveError}
          </NoticeBox>
        </div>
      )}
      {wizard.saved && (
        <div style={{ marginBottom: 16 }}>
          <NoticeBox valid title={i18n.t('Settings saved')}>
            {i18n.t('Your changes have been saved.')}
          </NoticeBox>
        </div>
      )}

      {wizard.step === 0 && <RouteSetupStep wizard={wizard} authorities={authorities} fhirRoute={fhirRoute} />}
      {wizard.step === 1 && <OrgUnitAndPagingStep wizard={wizard} />}
      {wizard.step === 2 && <NotifyStep wizard={wizard} />}
    </div>
  )
}

function RouteSetupStep({ wizard, authorities, fhirRoute }: Props) {
  const [openModal, setOpenModal] = useState<'fhir' | 'gateway' | null>(null)
  const { draft, setDraft } = wizard

  const selectedRoute = fhirRoute.wildcardRoutes.find((r) => r.id === draft.routeId) ?? null
  const selectedGatewayRoute = fhirRoute.wildcardRoutes.find((r) => r.id === draft.gatewayRouteId) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <h3 style={{ margin: '0 0 8px' }}>{i18n.t('FHIR connection')}</h3>
        <p style={{ color: '#6e7a89', fontSize: 13, marginTop: 0 }}>
          {i18n.t(
            'Every call to the FHIR server goes through a DHIS2 Route -- this instance makes the outbound call, not your browser, so credentials are never exposed client-side.',
          )}
        </p>

        <RoutePicker
          fhirRoute={fhirRoute}
          selectedRouteId={draft.routeId}
          onSelect={(id) => setDraft((prev) => ({ ...prev, routeId: id }))}
          canCreateRoutes={authorities.canCreateRoutes}
          onRequestCreate={() => setOpenModal('fhir')}
          label={i18n.t('Route')}
          emptyTitle={i18n.t('No routes to a FHIR server found yet')}
        />

        {selectedRoute && (
          <p style={{ fontSize: 12, color: '#6e7a89', marginTop: 4 }}>
            {i18n.t('Selected route target --')} <code>{selectedRoute.url}</code>
          </p>
        )}
      </section>

      <section>
        <h3 style={{ margin: '0 0 8px' }}>{i18n.t('Immunization gateway service')}</h3>
        <p style={{ color: '#6e7a89', fontSize: 13, marginTop: 0 }}>
          {i18n.t(
            'The gateway panels talk to the standalone Java/Camel sync service (dhis2-route-b-sync) through a DHIS2 Route too -- not to hide credentials (it has none), but so your browser never needs direct network access to that service, and the service needs no CORS config of its own.',
          )}
        </p>

        <RoutePicker
          fhirRoute={fhirRoute}
          selectedRouteId={draft.gatewayRouteId}
          onSelect={(id) => setDraft((prev) => ({ ...prev, gatewayRouteId: id }))}
          canCreateRoutes={authorities.canCreateRoutes}
          onRequestCreate={() => setOpenModal('gateway')}
          label={i18n.t('Gateway route')}
          emptyTitle={i18n.t('No routes to the gateway service found yet')}
        />

        {selectedGatewayRoute && (
          <p style={{ fontSize: 12, color: '#6e7a89', marginTop: 4 }}>
            {i18n.t('Selected route target --')} <code>{selectedGatewayRoute.url}</code>
          </p>
        )}
      </section>

      <div>
        <Button primary onClick={wizard.next} disabled={!wizard.stepValid[0]}>
          {i18n.t('Next')}
        </Button>
      </div>

      {openModal === 'fhir' && (
        <RouteCreateModal
          fhirRoute={fhirRoute}
          title={i18n.t('Add FHIR connection route')}
          defaultBaseUrl="https://hapi.fhir.org/baseR4"
          baseUrlLabel={i18n.t('FHIR base URL')}
          onCreated={(id) => {
            setDraft((prev) => ({ ...prev, routeId: id }))
            setOpenModal(null)
          }}
          onClose={() => setOpenModal(null)}
        />
      )}
      {openModal === 'gateway' && (
        <RouteCreateModal
          fhirRoute={fhirRoute}
          title={i18n.t('Add gateway service route')}
          defaultBaseUrl="http://localhost:8090"
          baseUrlLabel={i18n.t('Gateway service base URL')}
          onCreated={(id) => {
            setDraft((prev) => ({ ...prev, gatewayRouteId: id }))
            setOpenModal(null)
          }}
          onClose={() => setOpenModal(null)}
        />
      )}
    </div>
  )
}

function OrgUnitAndPagingStep({ wizard }: { wizard: UseSettingsWizardResult }) {
  const { draft, setDraft } = wizard
  const [selectedOrgUnitPath, setSelectedOrgUnitPath] = useState<string | null>(null)
  const { data: rootsData } = useDataQuery<OrgUnitRootsResponse>(orgUnitRootsQuery)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <h3 style={{ margin: '0 0 8px' }}>{i18n.t('Target organisation unit')}</h3>
        {rootsData ? (
          <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #dbe4ea', borderRadius: 4, padding: 8 }}>
            <OrganisationUnitTree
              roots={rootsData.roots.organisationUnits.map((ou) => ou.id)}
              singleSelection
              selected={selectedOrgUnitPath ? [selectedOrgUnitPath] : []}
              onChange={(payload) => {
                setSelectedOrgUnitPath(payload.path)
                setDraft((prev) => ({ ...prev, orgUnitId: payload.id }))
              }}
            />
          </div>
        ) : (
          <CircularLoader small />
        )}
      </section>

      <section style={{ display: 'flex', gap: 16 }}>
        <InputField
          label={i18n.t('Page size')}
          type="number"
          value={String(draft.pageCount)}
          onChange={({ value }) => setDraft((prev) => ({ ...prev, pageCount: Number(value ?? prev.pageCount) }))}
          error={!wizard.pageCountValid}
          validationText={
            wizard.pageCountValid
              ? undefined
              : i18n.t('Must be between {{min}} and {{max}}.', { min: PAGE_COUNT_RANGE.min, max: PAGE_COUNT_RANGE.max })
          }
          helpText={i18n.t('Resources fetched per page from the FHIR server.')}
        />
        <InputField
          label={i18n.t('Max pages')}
          type="number"
          value={String(draft.maxPages)}
          onChange={({ value }) => setDraft((prev) => ({ ...prev, maxPages: Number(value ?? prev.maxPages) }))}
          error={!wizard.maxPagesValid}
          validationText={
            wizard.maxPagesValid
              ? undefined
              : i18n.t('Must be between {{min}} and {{max}}.', { min: MAX_PAGES_RANGE.min, max: MAX_PAGES_RANGE.max })
          }
          helpText={i18n.t("Upper bound on pages followed per run, so a huge result set can't run away.")}
        />
      </section>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={wizard.back}>{i18n.t('Back')}</Button>
        <Button primary onClick={wizard.next} disabled={!wizard.stepValid[1]}>
          {i18n.t('Next')}
        </Button>
      </div>
    </div>
  )
}

function NotifyStep({ wizard }: { wizard: UseSettingsWizardResult }) {
  const { draft, setDraft } = wizard
  const { data: groupsData } = useDataQuery<UserGroupsResponse>(userGroupsQuery)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section>
        <h3 style={{ margin: '0 0 8px' }}>{i18n.t('Notify on errors')}</h3>
        {groupsData ? (
          <SingleSelectField
            label={i18n.t('User group to notify')}
            clearable
            selected={draft.notifyUserGroupId ?? ''}
            onChange={({ selected }) => setDraft((prev) => ({ ...prev, notifyUserGroupId: selected || null }))}
          >
            {groupsData.groups.userGroups.map((g) => (
              <SingleSelectOption key={g.id} value={g.id} label={g.displayName} />
            ))}
          </SingleSelectField>
        ) : (
          <CircularLoader small />
        )}
      </section>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={wizard.back}>{i18n.t('Back')}</Button>
        <Button primary onClick={wizard.save} loading={wizard.saving}>
          {i18n.t('Save settings')}
        </Button>
      </div>
    </div>
  )
}

function RoutePicker({
  fhirRoute,
  selectedRouteId,
  onSelect,
  canCreateRoutes,
  onRequestCreate,
  label,
  emptyTitle,
}: {
  fhirRoute: UseFhirRouteResult
  selectedRouteId: string | null
  onSelect: (id: string) => void
  canCreateRoutes: boolean
  onRequestCreate: () => void
  label: string
  emptyTitle: string
}) {
  if (fhirRoute.loading) return <CircularLoader small />

  if (fhirRoute.error) {
    return (
      <NoticeBox error title={i18n.t('Could not load routes')}>
        {fhirRoute.error}
      </NoticeBox>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {fhirRoute.wildcardRoutes.length > 0 ? (
        <SingleSelectField label={label} selected={selectedRouteId ?? ''} onChange={({ selected }) => onSelect(selected)}>
          {fhirRoute.wildcardRoutes.map((r) => (
            <SingleSelectOption key={r.id} value={r.id} label={r.name} />
          ))}
        </SingleSelectField>
      ) : (
        <NoticeBox title={emptyTitle}>{i18n.t('Set one up in the Route Manager app, or create one here.')}</NoticeBox>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <Button small onClick={() => window.open('../route-manager/index.html', '_blank')}>
          {i18n.t('Open Route Manager')}
        </Button>
        {canCreateRoutes && (
          <Button small icon={<IconAdd16 />} onClick={onRequestCreate}>
            {i18n.t('Add route')}
          </Button>
        )}
      </div>

      {!canCreateRoutes && fhirRoute.wildcardRoutes.length === 0 && (
        <NoticeBox warning title={i18n.t('You may not have permission to create a route')}>
          {i18n.t(
            'Creating a route needs the "Route" authority (or a superuser role). Ask your DHIS2 administrator, or use Route Manager if you already have access there.',
          )}
        </NoticeBox>
      )}
    </div>
  )
}
