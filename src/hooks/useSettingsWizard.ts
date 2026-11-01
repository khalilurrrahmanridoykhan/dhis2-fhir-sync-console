import { useEffect, useRef, useState } from 'react'
import type { SettingsBlob } from '../lib/dataStore'
import { isInRange } from '../lib/validation'

const PAGE_COUNT_RANGE = { min: 1, max: 200 }
const MAX_PAGES_RANGE = { min: 1, max: 1000 }

export const SETTINGS_STEP_COUNT = 3

export interface UseSettingsWizardResult {
  draft: SettingsBlob
  setDraft: (updater: (prev: SettingsBlob) => SettingsBlob) => void
  step: number
  maxStepReached: number
  goToStep: (step: number) => void
  next: () => void
  back: () => void
  /** Index 0 = route setup, 1 = org unit & paging, 2 = notifications. */
  stepValid: [boolean, boolean, boolean]
  pageCountValid: boolean
  maxPagesValid: boolean
  saving: boolean
  saveError: string | null
  saved: boolean
  save: () => Promise<void>
}

// Lifted out of SettingsForm so both the wizard content AND AppShell's secondary
// sidebar (which needs to know step validity/lock state to render its own nav) share
// one source of truth, rather than two copies of step state getting out of sync.
// A returning user who already has valid settings shouldn't have to click through
// steps they've already completed every time they open Settings -- start at (and
// unlock up to) whichever step their already-saved settings reach.
function initialStepFor(settings: SettingsBlob): number {
  if (settings.routeId && settings.gatewayRouteId && settings.orgUnitId) return 2
  if (settings.routeId && settings.gatewayRouteId) return 1
  return 0
}

export function useSettingsWizard(
  settings: SettingsBlob,
  onSave: (settings: SettingsBlob) => Promise<void>,
): UseSettingsWizardResult {
  const [draft, setDraftState] = useState<SettingsBlob>(settings)
  const [step, setStep] = useState(0)
  const [maxStepReached, setMaxStepReached] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // The hook is constructed before the real settings GET resolves (App.tsx's own
  // loading gate hasn't cleared yet), so the lazy useState initializers above would
  // only ever see an empty placeholder blob -- initialStepFor has to run again here,
  // once real data arrives, via this ref-guarded one-shot jump instead.
  const autoAdvancedRef = useRef(false)

  // `settings` only changes identity on a real load or a successful save (see
  // useSettings.ts) -- re-seeding the draft then is exactly what's wanted: it
  // picks up the real saved values once the initial load resolves, and is a
  // harmless no-op (same values) right after this hook's own save() call.
  useEffect(() => {
    setDraftState(settings)
    const reachable = initialStepFor(settings)
    setMaxStepReached((prev) => Math.max(prev, reachable))
    if (!autoAdvancedRef.current && reachable > 0) {
      autoAdvancedRef.current = true
      setStep(reachable)
    }
  }, [settings])

  function setDraft(updater: (prev: SettingsBlob) => SettingsBlob) {
    setDraftState(updater)
    setSaved(false)
  }

  const pageCountValid = isInRange(draft.pageCount, PAGE_COUNT_RANGE)
  const maxPagesValid = isInRange(draft.maxPages, MAX_PAGES_RANGE)

  const stepValid: [boolean, boolean, boolean] = [
    Boolean(draft.routeId && draft.gatewayRouteId),
    Boolean(draft.orgUnitId) && pageCountValid && maxPagesValid,
    true,
  ]

  function goToStep(target: number) {
    if (target <= maxStepReached) setStep(target)
  }

  function next() {
    if (!stepValid[step]) return
    const nextStep = Math.min(step + 1, SETTINGS_STEP_COUNT - 1)
    setStep(nextStep)
    setMaxStepReached((prev) => Math.max(prev, nextStep))
  }

  function back() {
    setStep((prev) => Math.max(prev - 1, 0))
  }

  async function save() {
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

  return {
    draft,
    setDraft,
    step,
    maxStepReached,
    goToStep,
    next,
    back,
    stepValid,
    pageCountValid,
    maxPagesValid,
    saving,
    saveError,
    saved,
    save,
  }
}
