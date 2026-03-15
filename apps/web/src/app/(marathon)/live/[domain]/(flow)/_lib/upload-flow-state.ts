import { z } from "zod"

export interface UploadFlowStateSnapshot {
  competitionClassId: number | null
  deviceGroupId: number | null
  participantId: number | null
  participantRef: string | null
  participantEmail: string | null
  participantFirstName: string | null
  participantLastName: string | null
  participantPhone: string | null
  replaceExistingActiveTopicUpload: boolean | null
  uploadInstructionsShown?: boolean
}

interface ParticipantDetailsValues {
  firstname: string
  lastname: string
  email: string
  phone: string
}

interface ParticipantPatchOptions {
  participantId?: number | null
  participantRef?: string | null
  replaceExistingActiveTopicUpload?: boolean | null
  trimPhone?: boolean
}

const participantIdentitySchema = z.object({
  participantFirstName: z.string().min(1),
  participantLastName: z.string().min(1),
  participantEmail: z.string().min(1),
})

export const byCameraUploadStateSchema = participantIdentitySchema.extend({
  deviceGroupId: z.number(),
  participantPhone: z.string().min(1),
  replaceExistingActiveTopicUpload: z.boolean().nullable().optional(),
})

export const marathonUploadStateSchema = participantIdentitySchema.extend({
  participantRef: z.string().min(1),
  competitionClassId: z.number(),
  deviceGroupId: z.number(),
  participantPhone: z.string().min(1),
})

const marathonDeviceSelectionStateSchema = participantIdentitySchema.extend({
  deviceGroupId: z.number(),
  competitionClassId: z.number(),
})

export function hasParticipantIdentity(state: UploadFlowStateSnapshot) {
  return participantIdentitySchema.safeParse(state).success
}

export function hasDeviceSelectionRequirements(
  state: UploadFlowStateSnapshot,
  isByCameraMode: boolean,
) {
  if (isByCameraMode) {
    return byCameraUploadStateSchema.safeParse(state).success
  }
  return marathonDeviceSelectionStateSchema.safeParse(state).success
}

export function hasMarathonUploadRequirements(state: UploadFlowStateSnapshot) {
  return marathonUploadStateSchema.safeParse(state).success
}

export function toParticipantFlowStatePatch(
  values: ParticipantDetailsValues,
  options: ParticipantPatchOptions = {},
) {
  const phoneValue = options.trimPhone ? values.phone.trim() || null : values.phone

  return {
    participantFirstName: values.firstname,
    participantLastName: values.lastname,
    participantEmail: values.email,
    participantPhone: phoneValue,
    ...("participantId" in options ? { participantId: options.participantId ?? null } : {}),
    ...("participantRef" in options ? { participantRef: options.participantRef ?? null } : {}),
    ...("replaceExistingActiveTopicUpload" in options
      ? {
          replaceExistingActiveTopicUpload: options.replaceExistingActiveTopicUpload ?? null,
        }
      : {}),
  }
}

const initializeUploadFlowInputSchema = marathonUploadStateSchema.transform((data) => ({
  reference: data.participantRef,
  firstname: data.participantFirstName,
  lastname: data.participantLastName,
  email: data.participantEmail,
  competitionClassId: data.competitionClassId,
  deviceGroupId: data.deviceGroupId,
  phoneNumber: data.participantPhone,
}))

export function buildInitializeUploadFlowInput(domain: string, state: UploadFlowStateSnapshot) {
  const result = initializeUploadFlowInputSchema.safeParse(state)
  if (!result.success) return null
  return { domain, ...result.data }
}

const initializeByCameraUploadInputSchema = byCameraUploadStateSchema.transform((data) => ({
  firstname: data.participantFirstName,
  lastname: data.participantLastName,
  email: data.participantEmail,
  deviceGroupId: data.deviceGroupId,
  phoneNumber: data.participantPhone,
  replaceExistingActiveTopicUpload: data.replaceExistingActiveTopicUpload ?? undefined,
}))

export function buildInitializeByCameraUploadInput(domain: string, state: UploadFlowStateSnapshot) {
  const result = initializeByCameraUploadInputSchema.safeParse(state)
  if (!result.success) return null
  return { domain, ...result.data }
}

export function buildPrepareUploadFlowInput(domain: string, state: UploadFlowStateSnapshot) {
  const result = marathonUploadStateSchema.safeParse(state)
  if (!result.success) return null
  return {
    domain,
    reference: result.data.participantRef,
    firstname: result.data.participantFirstName,
    lastname: result.data.participantLastName,
    email: result.data.participantEmail,
    competitionClassId: result.data.competitionClassId,
    deviceGroupId: result.data.deviceGroupId,
    phoneNumber: result.data.participantPhone,
  }
}

export function buildPrepareCompletedSearchParams(state: UploadFlowStateSnapshot) {
  const result = marathonUploadStateSchema.safeParse(state)
  if (!result.success) return null
  return {
    competitionClassId: result.data.competitionClassId,
    deviceGroupId: result.data.deviceGroupId,
    participantId: state.participantId,
    participantRef: result.data.participantRef,
    participantEmail: result.data.participantEmail,
    participantFirstName: result.data.participantFirstName,
    participantLastName: result.data.participantLastName,
  }
}
