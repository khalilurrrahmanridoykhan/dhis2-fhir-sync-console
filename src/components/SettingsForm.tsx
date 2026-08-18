import { useDataQuery } from '@dhis2/app-runtime'
import {
  Button,
  CircularLoader,
  InputField,
  NoticeBox,
  OrganisationUnitTree,
  Radio,
  SingleSelectField,
  SingleSelectOption,
} from '@dhis2/ui'
import { useState } from 'react'
import type { CreateRouteInput, UseFhirRouteResult } from '../hooks/useFhirRoute'
import type { CurrentUserAuthorities } from '../hooks/useCurrentUserAuthorities'
import i18n from '../i18n'
import type { FhirAuthType, SettingsBlob } from '../lib/dataStore'
import { isInRange } from '../lib/validation'

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
  settings: SettingsBlob
  onSave: (settings: SettingsBlob) => Promise<void>
  authorities: CurrentUserAuthorities
  fhirRoute: UseFhirRouteResult
}

export function SettingsForm({ settings, onSave, authorities, fhirRoute }: Props) {
  const [draft, setDraft] = useState<SettingsBlob>(settings)
  const [selectedOrgUnitPath, setSelectedOrgUnitPath] = useState<string | null>(null)
  const [showCreateRoute, setShowCreateRoute] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const { data: rootsData } = useDataQuery<OrgUnitRootsResponse>(orgUnitRootsQuery)
  const { data: groupsData } = useDataQuery<UserGroupsResponse>(userGroupsQuery)

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      await onSave(draft)
      setSaved(true)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const selectedRoute = fhirRoute.wildcardRoutes.find((r) => r.id === draft.routeId) ?? null

  const pageCountValid = isInRange(draft.pageCount, PAGE_COUNT_RANGE)
  const maxPagesValid = isInRange(draft.maxPages, MAX_PAGES_RANGE)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      {saveError && (
        <NoticeBox error title={i18n.t('Could not save settings')}>
          {saveError}
        </NoticeBox>
      )}
      {saved && (
        <NoticeBox valid title={i18n.t('Settings saved')}>
          {i18n.t('Your changes have been saved.')}
        </NoticeBox>
      )}

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
          showCreateRoute={showCreateRoute}
          onToggleCreateRoute={setShowCreateRoute}
        />

        {selectedRoute && (
          <p style={{ fontSize: 12, color: '#6e7a89', marginTop: 4 }}>
            {i18n.t('Selected route target --')} <code>{selectedRoute.url}</code>
          </p>
        )}
      </section>

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
          error={!pageCountValid}
          validationText={
            pageCountValid
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
          error={!maxPagesValid}
          validationText={
            maxPagesValid
              ? undefined
              : i18n.t('Must be between {{min}} and {{max}}.', { min: MAX_PAGES_RANGE.min, max: MAX_PAGES_RANGE.max })
          }
          helpText={i18n.t("Upper bound on pages followed per run, so a huge result set can't run away.")}
        />
      </section>

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

      <Button
        primary
        onClick={handleSave}
        loading={saving}
        disabled={!draft.routeId || !draft.orgUnitId || !pageCountValid || !maxPagesValid}
      >
        {i18n.t('Save settings')}
      </Button>
    </div>
  )
}

function RoutePicker({
  fhirRoute,
  selectedRouteId,
  onSelect,
  canCreateRoutes,
  showCreateRoute,
  onToggleCreateRoute,
}: {
  fhirRoute: UseFhirRouteResult
  selectedRouteId: string | null
  onSelect: (id: string) => void
  canCreateRoutes: boolean
  showCreateRoute: boolean
  onToggleCreateRoute: (show: boolean) => void
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
        <SingleSelectField label={i18n.t('Route')} selected={selectedRouteId ?? ''} onChange={({ selected }) => onSelect(selected)}>
          {fhirRoute.wildcardRoutes.map((r) => (
            <SingleSelectOption key={r.id} value={r.id} label={r.name} />
          ))}
        </SingleSelectField>
      ) : (
        <NoticeBox title={i18n.t('No routes to a FHIR server found yet')}>
          {i18n.t('Set one up in the Route Manager app, or create one here.')}
        </NoticeBox>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <Button small onClick={() => window.open('../route-manager/index.html', '_blank')}>
          {i18n.t('Open Route Manager')}
        </Button>
        {canCreateRoutes && (
          <Button small onClick={() => onToggleCreateRoute(!showCreateRoute)}>
            {showCreateRoute ? i18n.t('Cancel') : i18n.t('Create a route here')}
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

      {showCreateRoute && canCreateRoutes && <CreateRouteForm fhirRoute={fhirRoute} onCreated={onSelect} />}
    </div>
  )
}

function CreateRouteForm({ fhirRoute, onCreated }: { fhirRoute: UseFhirRouteResult; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://hapi.fhir.org/baseR4')
  const [authType, setAuthType] = useState<FhirAuthType>('none')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [timeoutSeconds, setTimeoutSeconds] = useState('30')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim() || !baseUrl.trim()) {
      setError(i18n.t('Name and FHIR base URL are required.'))
      return
    }
    setError(null)
    setCreating(true)
    try {
      const input: CreateRouteInput = {
        name: name.trim(),
        code: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        baseUrl: baseUrl.trim(),
        authType,
        responseTimeoutSeconds: Number(timeoutSeconds) || 30,
        authConfig:
          authType === 'http-basic'
            ? { username, password }
            : authType === 'api-token' || authType === 'api-headers'
              ? { token }
              : undefined,
      }
      const id = await fhirRoute.createRoute(input)
      onCreated(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ border: '1px solid #dbe4ea', borderRadius: 6, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {error && (
        <NoticeBox error title={i18n.t('Could not create route')}>
          {error}
        </NoticeBox>
      )}
      <InputField
        label={i18n.t('Route name')}
        value={name}
        onChange={({ value }) => setName(value ?? '')}
        placeholder={i18n.t('e.g. Clinic FHIR server')}
      />
      <InputField
        label={i18n.t('FHIR base URL')}
        value={baseUrl}
        onChange={({ value }) => setBaseUrl(value ?? '')}
        helpText={i18n.t(
          'A "/**" wildcard suffix is added automatically -- required to proxy a paginated FHIR API through this route.',
        )}
      />
      <InputField
        label={i18n.t('Response timeout (seconds, max 60)')}
        type="number"
        value={timeoutSeconds}
        onChange={({ value }) => setTimeoutSeconds(value ?? '30')}
      />

      <div>
        <div style={{ marginBottom: 6, fontWeight: 500 }}>{i18n.t('Authentication')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Radio label={i18n.t('None (public server)')} checked={authType === 'none'} onChange={() => setAuthType('none')} />
          <Radio
            label={i18n.t('Basic auth (username/password)')}
            checked={authType === 'http-basic'}
            onChange={() => setAuthType('http-basic')}
          />
          <Radio
            label={i18n.t('Bearer token (incl. SMART on FHIR static token)')}
            checked={authType === 'api-headers'}
            onChange={() => setAuthType('api-headers')}
          />
          <Radio label={i18n.t('API token')} checked={authType === 'api-token'} onChange={() => setAuthType('api-token')} />
        </div>
      </div>

      {authType === 'http-basic' && (
        <>
          <InputField label={i18n.t('Username')} value={username} onChange={({ value }) => setUsername(value ?? '')} />
          <InputField
            label={i18n.t('Password')}
            type="password"
            value={password}
            onChange={({ value }) => setPassword(value ?? '')}
          />
        </>
      )}
      {(authType === 'api-token' || authType === 'api-headers') && (
        <InputField
          label={authType === 'api-headers' ? i18n.t('Bearer token') : i18n.t('API token')}
          type="password"
          value={token}
          onChange={({ value }) => setToken(value ?? '')}
          helpText={
            authType === 'api-headers'
              ? i18n.t('Sent as "Authorization -- Bearer <token>". Not auto-refreshed -- rotate manually if it expires.')
              : undefined
          }
        />
      )}

      <Button primary small onClick={handleCreate} loading={creating}>
        {i18n.t('Create route')}
      </Button>
    </div>
  )
}
