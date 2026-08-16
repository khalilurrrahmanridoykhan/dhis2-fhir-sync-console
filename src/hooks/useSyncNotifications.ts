// Confirmed real, documented DHIS2 endpoint: POST /api/messageConversations.
// Sends a message to the configured user group when a run has errors, so an
// admin doesn't have to remember to open this console to find out.

import { useDataEngine } from '@dhis2/app-runtime'
import { useCallback } from 'react'

export interface RunSummaryForNotification {
  timestamp: string
  fetched: number
  created: number
  updated: number
  errors: { fhirImmunizationId: string; message: string }[]
}

export interface UseSyncNotificationsResult {
  notifyOnErrors: (userGroupId: string, summary: RunSummaryForNotification) => Promise<void>
}

export function useSyncNotifications(): UseSyncNotificationsResult {
  const engine = useDataEngine()

  const notifyOnErrors = useCallback(
    async (userGroupId: string, summary: RunSummaryForNotification) => {
      if (summary.errors.length === 0) return

      const errorLines = summary.errors.slice(0, 10).map((e) => `- ${e.fhirImmunizationId}: ${e.message}`).join('\n')
      const moreCount = summary.errors.length - 10

      await engine.mutate({
        resource: 'messageConversations',
        type: 'create',
        data: {
          subject: `FHIR Sync Console: ${summary.errors.length} error(s) in the run at ${summary.timestamp}`,
          text:
            `Fetched: ${summary.fetched}, created: ${summary.created}, updated: ${summary.updated}, ` +
            `errors: ${summary.errors.length}.\n\n${errorLines}` +
            (moreCount > 0 ? `\n...and ${moreCount} more (see the console's Run History for the full list).` : ''),
          organisationUnits: [],
          userGroups: [{ id: userGroupId }],
        },
      })
    },
    [engine],
  )

  return { notifyOnErrors }
}
