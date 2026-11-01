import { Button, IconCross24, InputField, Modal, ModalActions, ModalContent, ModalTitle, NoticeBox, Radio } from '@dhis2/ui'
import { useState } from 'react'
import type { UseFhirRouteResult, CreateRouteInput } from '../hooks/useFhirRoute'
import i18n from '../i18n'
import type { FhirAuthType } from '../lib/dataStore'

interface Props {
  fhirRoute: UseFhirRouteResult
  title: string
  defaultBaseUrl: string
  baseUrlLabel: string
  onCreated: (id: string) => void
  onClose: () => void
}

// Popup version of the old inline-expanding create-route form -- matches the
// Modal/ModalTitle/ModalContent/ModalActions pattern official DHIS2 apps use for
// "add X" dialogs (e.g. the CHAP connector's own "Add route" popup).
export function RouteCreateModal({ fhirRoute, title, defaultBaseUrl, baseUrlLabel, onCreated, onClose }: Props) {
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl)
  const [authType, setAuthType] = useState<FhirAuthType>('none')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [timeoutSeconds, setTimeoutSeconds] = useState('30')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim() || !baseUrl.trim()) {
      setError(i18n.t('Name and base URL are required.'))
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
    <Modal onClose={onClose} position="middle">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <ModalTitle>{title}</ModalTitle>
        <Button small secondary icon={<IconCross24 />} onClick={onClose} dataTest="route-create-modal-close" />
      </div>
      <ModalContent>
        {error && (
          <div style={{ marginBottom: 12 }}>
            <NoticeBox error title={i18n.t('Could not create route')}>
              {error}
            </NoticeBox>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InputField
            label={i18n.t('Route name')}
            value={name}
            onChange={({ value }) => setName(value ?? '')}
            placeholder={i18n.t('e.g. Clinic FHIR server')}
          />
          <InputField
            label={baseUrlLabel}
            value={baseUrl}
            onChange={({ value }) => setBaseUrl(value ?? '')}
            helpText={i18n.t(
              'A "/**" wildcard suffix is added automatically -- required to proxy an arbitrary sub-path through this route.',
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
        </div>
      </ModalContent>
      <ModalActions>
        <Button onClick={onClose}>{i18n.t('Cancel')}</Button>
        <Button primary onClick={handleCreate} loading={creating}>
          {i18n.t('Add')}
        </Button>
      </ModalActions>
    </Modal>
  )
}
