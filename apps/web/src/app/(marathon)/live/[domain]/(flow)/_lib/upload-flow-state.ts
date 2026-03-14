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

export function hasParticipantIdentity(state: UploadFlowStateSnapshot) {
  return Boolean(state.participantFirstName && state.participantLastName && state.participantEmail)
}

export function hasDeviceSelectionRequirements(
  state: UploadFlowStateSnapshot,
  isByCameraMode: boolean,
) {
  if (!hasParticipantIdentity(state) || !state.deviceGroupId) {
    return false
  }

  if (isByCameraMode) {
    return true
  }

  return Boolean(state.competitionClassId)
}

export function hasMarathonUploadRequirements(state: UploadFlowStateSnapshot) {
  return Boolean(
    state.participantRef &&
    hasParticipantIdentity(state) &&
    state.competitionClassId &&
    state.deviceGroupId,
  )
}

export function hasByCameraUploadRequirements(state: UploadFlowStateSnapshot) {
  return Boolean(hasParticipantIdentity(state) && state.participantPhone && state.deviceGroupId)
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

export function buildInitializeUploadFlowInput(domain: string, state: UploadFlowStateSnapshot) {
  if (!hasMarathonUploadRequirements(state)) {
    return null
  }

  return {
    domain,
    reference: state.participantRef,
    firstname: state.participantFirstName,
    lastname: state.participantLastName,
    email: state.participantEmail,
    competitionClassId: state.competitionClassId,
    deviceGroupId: state.deviceGroupId,
    phoneNumber: state.participantPhone,
  }
}

export function buildInitializeByCameraUploadInput(domain: string, state: UploadFlowStateSnapshot) {
  if (!hasByCameraUploadRequirements(state)) {
    return null
  }

  return {
    domain,
    firstname: state.participantFirstName,
    lastname: state.participantLastName,
    email: state.participantEmail,
    deviceGroupId: state.deviceGroupId,
    phoneNumber: state.participantPhone,
    replaceExistingActiveTopicUpload: state.replaceExistingActiveTopicUpload ?? undefined,
  }
}

export function buildPrepareUploadFlowInput(domain: string, state: UploadFlowStateSnapshot) {
  if (!hasMarathonUploadRequirements(state)) {
    return null
  }

  return {
    domain,
    reference: state.participantRef,
    firstname: state.participantFirstName,
    lastname: state.participantLastName,
    email: state.participantEmail,
    competitionClassId: state.competitionClassId,
    deviceGroupId: state.deviceGroupId,
    phoneNumber: state.participantPhone,
  }
}

export function buildPrepareCompletedSearchParams(state: UploadFlowStateSnapshot) {
  if (!hasMarathonUploadRequirements(state)) {
    return null
  }

  return {
    competitionClassId: state.competitionClassId,
    deviceGroupId: state.deviceGroupId,
    participantId: state.participantId,
    participantRef: state.participantRef,
    participantEmail: state.participantEmail,
    participantFirstName: state.participantFirstName,
    participantLastName: state.participantLastName,
  }
}
