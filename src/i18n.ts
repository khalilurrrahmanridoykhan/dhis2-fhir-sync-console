// Wraps the auto-generated src/locales/index.js (see ambient.d.ts) instead of
// importing it directly everywhere. Real bug found live on
// dhis2.krrkhan.com: i18next's Interpolator caches `escapeValue` (default
// true, meant for apps that render translated strings via
// dangerouslySetInnerHTML) once at construction from the instance's own
// init-time options -- @dhis2/d2-i18n's init never sets it, so it silently
// HTML-entity-escapes every interpolated value. Confirmed: "Last synced
// 8/17/2026..." rendered as "Last synced 8&#x2F;17&#x2F;2026...". React
// already escapes JSX text on its own, so this second escaping pass is
// always redundant here, never protective.
//
// Mutating the shared instance's options after init does NOT retroactively
// change the already-constructed Interpolator (confirmed by reading the
// installed i18next's own source, not assumed) -- but passing
// `interpolation: { escapeValue: false }` in a single call's own options
// DOES work, because i18next re-inits its shared interpolator just for
// that call and resets it after. Centralized here once, rather than
// remembering to add it to every t() call site.
import rawI18n from './locales'

const i18n = {
  t: (key: string, options?: Record<string, unknown>): string =>
    rawI18n.t(key, options ? { ...options, interpolation: { escapeValue: false } } : undefined) as string,
}

export default i18n
