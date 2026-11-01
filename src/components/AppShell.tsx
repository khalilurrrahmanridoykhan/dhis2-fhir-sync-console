import { IconChevronRight24, IconArrowLeft16 } from '@dhis2/ui'
import { ReactNode } from 'react'
import i18n from '../i18n'

export type TabId = 'sync' | 'history' | 'immunization' | 'metadata' | 'settings'

interface NavItem {
  id: TabId
  label: string
}

const SIDEBAR_WIDTH = 240
const COLLAPSED_WIDTH = 48

export interface SettingsStepInfo {
  label: string
  unlocked: boolean
}

interface Props {
  activeTab: TabId
  onSelectTab: (tab: TabId) => void
  /** Sync/Run history/Immunization/Metadata are disabled until settings are complete --
   * Settings itself is always reachable. */
  tabsEnabled: boolean
  children: ReactNode
  /** When set (only while activeTab === 'settings'), the shell switches to the
   * secondary-sidebar layout: the primary nav collapses to a thin strip and this
   * step list renders as its own dark sidebar, mirroring the Modeling app's
   * "App Settings" screen (back-to-app link, collapsed primary nav, nested nav). */
  settingsSteps?: SettingsStepInfo[]
  activeSettingsStep?: number
  onSelectSettingsStep?: (step: number) => void
  onBackToApp?: () => void
}

// Mirrors the dark left-nav pattern used by official DHIS2 apps (e.g. the Modeling
// app) -- plain inline styles, matching every other component in this app rather
// than introducing a CSS file or a routing library just for tab state.
export function AppShell({
  activeTab,
  onSelectTab,
  tabsEnabled,
  children,
  settingsSteps,
  activeSettingsStep = 0,
  onSelectSettingsStep,
  onBackToApp,
}: Props) {
  const inSettings = activeTab === 'settings' && settingsSteps != null

  const mainNav: NavItem[] = [
    { id: 'sync', label: i18n.t('Sync') },
    { id: 'history', label: i18n.t('Run history') },
    { id: 'immunization', label: i18n.t('Immunization gateway') },
    { id: 'metadata', label: i18n.t('Metadata gateway') },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {inSettings ? (
        <>
          <div
            style={{
              width: COLLAPSED_WIDTH,
              flexShrink: 0,
              backgroundColor: '#1b1f27',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingBottom: 16,
            }}
          >
            <button
              onClick={onBackToApp}
              title={i18n.t('Back to app')}
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                border: 'none',
                backgroundColor: '#2c323d',
                color: '#c6cbd4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <IconChevronRight24 />
            </button>
          </div>

          <nav
            style={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              backgroundColor: '#1b1f27',
              color: '#c6cbd4',
              display: 'flex',
              flexDirection: 'column',
              paddingTop: 16,
            }}
          >
            <button
              onClick={onBackToApp}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 20px 20px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#c6cbd4',
                fontSize: 14,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <IconArrowLeft16 /> {i18n.t('Back to app')}
            </button>

            {settingsSteps.map((stepInfo, index) => (
              <button
                key={stepInfo.label}
                onClick={() => stepInfo.unlocked && onSelectSettingsStep?.(index)}
                disabled={!stepInfo.unlocked}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 20px',
                  border: 'none',
                  borderLeft: activeSettingsStep === index ? '3px solid #2cb0a8' : '3px solid transparent',
                  backgroundColor: activeSettingsStep === index ? '#272d38' : 'transparent',
                  color: !stepInfo.unlocked ? '#5a6271' : activeSettingsStep === index ? '#ffffff' : '#c6cbd4',
                  fontSize: 14,
                  fontWeight: activeSettingsStep === index ? 500 : 400,
                  cursor: stepInfo.unlocked ? 'pointer' : 'default',
                }}
              >
                {stepInfo.label}
              </button>
            ))}
          </nav>
        </>
      ) : (
        <nav
          style={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            backgroundColor: '#1b1f27',
            color: '#c6cbd4',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            {mainNav.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={activeTab === item.id}
                disabled={!tabsEnabled}
                onClick={() => onSelectTab(item.id)}
              />
            ))}
          </div>

          <div style={{ borderTop: '1px solid #2c323d', paddingTop: 8, paddingBottom: 16 }}>
            <NavButton
              item={{ id: 'settings', label: i18n.t('Settings') }}
              active={activeTab === 'settings'}
              disabled={false}
              onClick={() => onSelectTab('settings')}
            />
          </div>
        </nav>
      )}

      <main style={{ flex: 1, backgroundColor: '#f2f3f5', padding: 24, overflowY: 'auto' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  )
}

function NavButton({ item, active, disabled, onClick }: { item: NavItem; active: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 20px',
        border: 'none',
        borderLeft: active ? '3px solid #2cb0a8' : '3px solid transparent',
        backgroundColor: active ? '#272d38' : 'transparent',
        color: disabled ? '#4b5160' : active ? '#ffffff' : '#c6cbd4',
        fontSize: 14,
        fontWeight: active ? 500 : 400,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {item.label}
    </button>
  )
}
