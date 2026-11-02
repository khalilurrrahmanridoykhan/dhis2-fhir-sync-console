import { IconChevronDown16, IconChevronRight16, IconChevronRight24, IconArrowLeft16 } from '@dhis2/ui'
import { ReactNode, useState } from 'react'
import i18n from '../i18n'

export type TabId =
  | 'sync'
  | 'immunization-d2f'
  | 'immunization-f2d'
  | 'metadata-orgunits'
  | 'metadata-optionsets'
  | 'metadata-trackedentities'
  | 'history'
  | 'sync-settings'
  | 'settings'

interface NavItem {
  id: TabId
  label: string
}

interface NavGroup {
  label: string
  children: NavItem[]
}

type NavEntry = ({ kind: 'item' } & NavItem) | ({ kind: 'group' } & NavGroup)

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

  // Manually-toggled groups only -- a group also counts as expanded whenever activeTab is
  // one of its own children (see isGroupExpanded), so navigating into a child always shows
  // where you are without needing to separately track/sync that here.
  const [manuallyExpandedGroups, setManuallyExpandedGroups] = useState<Set<string>>(new Set())

  const mainNav: NavEntry[] = [
    { kind: 'item', id: 'sync', label: i18n.t('Sync') },
    {
      kind: 'group',
      label: i18n.t('Immunization'),
      children: [
        { id: 'immunization-d2f', label: i18n.t('DHIS2 → FHIR') },
        { id: 'immunization-f2d', label: i18n.t('FHIR → DHIS2') },
      ],
    },
    {
      kind: 'group',
      label: i18n.t('Metadata'),
      children: [
        { id: 'metadata-orgunits', label: i18n.t('Org units') },
        { id: 'metadata-optionsets', label: i18n.t('Option sets') },
        { id: 'metadata-trackedentities', label: i18n.t('Tracked entities') },
      ],
    },
    { kind: 'item', id: 'history', label: i18n.t('Run history') },
    { kind: 'item', id: 'sync-settings', label: i18n.t('Sync settings') },
  ]

  function isGroupExpanded(group: NavGroup): boolean {
    return manuallyExpandedGroups.has(group.label) || group.children.some((c) => c.id === activeTab)
  }

  function toggleGroup(label: string) {
    setManuallyExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

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
            {mainNav.map((entry) =>
              entry.kind === 'item' ? (
                <NavButton
                  key={entry.id}
                  item={entry}
                  active={activeTab === entry.id}
                  disabled={!tabsEnabled}
                  onClick={() => onSelectTab(entry.id)}
                />
              ) : (
                <NavGroupButton
                  key={entry.label}
                  group={entry}
                  expanded={isGroupExpanded(entry)}
                  onToggle={() => toggleGroup(entry.label)}
                  activeTab={activeTab}
                  disabled={!tabsEnabled}
                  onSelectTab={onSelectTab}
                />
              ),
            )}
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

function NavGroupButton({
  group,
  expanded,
  onToggle,
  activeTab,
  disabled,
  onSelectTab,
}: {
  group: NavGroup
  expanded: boolean
  onToggle: () => void
  activeTab: TabId
  disabled: boolean
  onSelectTab: (tab: TabId) => void
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          textAlign: 'left',
          padding: '12px 20px',
          border: 'none',
          borderLeft: '3px solid transparent',
          backgroundColor: 'transparent',
          color: '#c6cbd4',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        {group.label}
        {expanded ? <IconChevronDown16 /> : <IconChevronRight16 />}
      </button>
      {expanded &&
        group.children.map((child) => (
          <NavButton
            key={child.id}
            item={child}
            active={activeTab === child.id}
            disabled={disabled}
            onClick={() => onSelectTab(child.id)}
            paddingLeft={40}
          />
        ))}
    </div>
  )
}

function NavButton({
  item,
  active,
  disabled,
  onClick,
  paddingLeft = 20,
}: {
  item: NavItem
  active: boolean
  disabled: boolean
  onClick: () => void
  paddingLeft?: number
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: `12px 20px 12px ${paddingLeft}px`,
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
