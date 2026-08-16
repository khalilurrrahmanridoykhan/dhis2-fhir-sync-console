/**
 * True when this app is running at the top of the window (opened directly
 * or on a pre-Global-Shell DHIS2 instance); false when embedded inside
 * DHIS2's Global Shell (v41+), which renders its own header bar -- so an
 * app must not render a second one on top of it. Built in from the start
 * here, not retrofitted after an App Hub review -- see README.
 * https://developers.dhis2.org/docs/references/global-shell/#header-bars
 */
export function useIsStandalone(): boolean {
  return typeof window !== 'undefined' && window.self === window.top
}
