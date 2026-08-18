// The I/O side of ../reused/provisioning.ts's pure payload builders --
// using @dhis2/app-runtime's engine.query/engine.mutate (session auth)
// instead of the original bridge's Node fetch+Basic-Auth client. Same
// find-or-create-by-name pattern as every sibling app's own
// hooks/useProvisionProgram.ts.

import type { useDataEngine } from '@dhis2/app-runtime'
import {
  DATA_ELEMENT_DEFS,
  PROGRAM_NAME,
  PROGRAM_SHARING_PAYLOAD,
  buildBatchEventPayload,
  buildDataElementPayload,
  buildProgramPayload,
  buildProgramStagePayload,
  parseTrackerBatchResult,
  type BatchEventItem,
  type BatchOutcome,
  type DataElementRole,
  type TrackerImportResponse,
} from '../reused/provisioning'
import type { ProvisionedProgram } from '../reused/types'

type DataEngine = ReturnType<typeof useDataEngine>

interface ProgramSearchResponse {
  programs: {
    programs: { id: string; programStages: { id: string; programStageDataElements: { dataElement: { id: string; name: string } }[] }[] }[]
  }
}

interface CreateResponse {
  response: { uid: string }
}

export async function findOrCreateProgram(engine: DataEngine, orgUnitIds: string[]): Promise<ProvisionedProgram> {
  const existing = await findExistingProgram(engine)
  if (existing) return existing
  return createProgram(engine, orgUnitIds)
}

async function findExistingProgram(engine: DataEngine): Promise<ProvisionedProgram | null> {
  const response = (await engine.query({
    programs: {
      resource: 'programs',
      params: {
        filter: `name:eq:${PROGRAM_NAME}`,
        fields: 'id,programStages[id,programStageDataElements[dataElement[id,name]]]',
      },
    },
  })) as unknown as ProgramSearchResponse

  const program = response.programs.programs[0]
  const stage = program?.programStages[0]
  if (!program || !stage) return null

  const dataElementIds: Partial<Record<DataElementRole, string>> = {}
  for (const def of DATA_ELEMENT_DEFS) {
    const match = stage.programStageDataElements.find((psde) => psde.dataElement.name === def.name)
    if (!match) return null
    dataElementIds[def.role] = match.dataElement.id
  }

  return { programId: program.id, programStageId: stage.id, dataElementIds: dataElementIds as Record<DataElementRole, string> }
}

async function createProgram(engine: DataEngine, orgUnitIds: string[]): Promise<ProvisionedProgram> {
  const dataElementIds: Partial<Record<DataElementRole, string>> = {}
  for (const def of DATA_ELEMENT_DEFS) {
    const response = (await engine.mutate({
      resource: 'dataElements',
      type: 'create',
      data: buildDataElementPayload(def),
    })) as unknown as CreateResponse
    dataElementIds[def.role] = response.response.uid
  }
  const resolvedDataElementIds = dataElementIds as Record<DataElementRole, string>

  const programResponse = (await engine.mutate({
    resource: 'programs',
    type: 'create',
    data: buildProgramPayload(orgUnitIds),
  })) as unknown as CreateResponse
  const programId = programResponse.response.uid

  const stageResponse = (await engine.mutate({
    resource: 'programStages',
    type: 'create',
    data: buildProgramStagePayload(programId, resolvedDataElementIds),
  })) as unknown as CreateResponse
  const programStageId = stageResponse.response.uid

  await engine.mutate({
    resource: `sharing?type=program&id=${programId}`,
    type: 'create',
    data: PROGRAM_SHARING_PAYLOAD,
  })

  return { programId, programStageId, dataElementIds: resolvedDataElementIds }
}

// Replaces the old submitCreateEvent/submitUpdateEvent -- one bulk POST for
// up to a whole batch of new AND updated events together (see
// buildBatchEventPayload's own header comment for why mixing them in one
// call is safe under DHIS2's default CREATE_AND_UPDATE import strategy).
// A non-OK top-level status still yields a normal BatchOutcome (empty
// succeeded set, one error per submitted event with the same message) --
// callers don't need a separate failure path for "the whole batch was
// rejected" vs "some events in it failed."
export async function submitEventBatch(
  engine: DataEngine,
  items: BatchEventItem[],
  provisioned: ProvisionedProgram,
  orgUnitId: string,
): Promise<BatchOutcome> {
  const payload = buildBatchEventPayload(items, provisioned, orgUnitId)
  const submittedEventIds = items.map((item) => item.existingEventId ?? item.eventId)
  const response = (await engine.mutate({
    resource: 'tracker?async=false',
    type: 'create',
    data: payload,
  })) as unknown as TrackerImportResponse
  return parseTrackerBatchResult(response, submittedEventIds)
}
