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

export type UploadFlowIssueField =
  | "participantRef"
  | "participantFirstName"
  | "participantLastName"
  | "participantEmail"
  | "participantPhone"
  | "competitionClassId"
  | "deviceGroupId"

export type UploadFlowIssueCode = "missing" | "invalid"

export type UploadFlowIssueMessageKey =
  | "missingParticipantNumber"
  | "missingFirstName"
  | "missingLastName"
  | "missingEmail"
  | "missingPhoneNumber"
  | "missingClassSelection"
  | "missingDeviceSelection"
  | "invalidParticipantEmail"

export interface UploadFlowIssue {
  field: UploadFlowIssueField
  code: UploadFlowIssueCode
  messageKey: UploadFlowIssueMessageKey
  step?: number
}

export type BuildResult<T> = { ok: true; data: T } | { ok: false; issues: UploadFlowIssue[] }

interface NormalizedUploadFlowState {
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

const uploadFlowIssueFields = new Set<UploadFlowIssueField>([
  "participantRef",
  "participantFirstName",
  "participantLastName",
  "participantEmail",
  "participantPhone",
  "competitionClassId",
  "deviceGroupId",
])

const requiredTextSchema = z.string().min(1)
const requiredEmailSchema = z.string().email()

const participantIdentitySchema = z.object({
  participantFirstName: requiredTextSchema,
  participantLastName: requiredTextSchema,
  participantEmail: requiredEmailSchema,
})

export const byCameraUploadStateSchema = participantIdentitySchema.extend({
  deviceGroupId: z.number(),
  participantPhone: requiredTextSchema,
  replaceExistingActiveTopicUpload: z.boolean().nullable().optional(),
})

export const marathonUploadStateSchema = participantIdentitySchema.extend({
  participantRef: requiredTextSchema,
  competitionClassId: z.number(),
  deviceGroupId: z.number(),
  participantPhone: z.string().nullable().optional(),
})

const marathonDeviceSelectionStateSchema = participantIdentitySchema.extend({
  deviceGroupId: z.number(),
  competitionClassId: z.number(),
})

const byCameraDeviceSelectionStateSchema = participantIdentitySchema.extend({
  deviceGroupId: z.number(),
  participantPhone: requiredTextSchema,
})

const missingMessageKeyByField: Record<UploadFlowIssueField, UploadFlowIssueMessageKey> = {
  participantRef: "missingParticipantNumber",
  participantFirstName: "missingFirstName",
  participantLastName: "missingLastName",
  participantEmail: "missingEmail",
  participantPhone: "missingPhoneNumber",
  competitionClassId: "missingClassSelection",
  deviceGroupId: "missingDeviceSelection",
}

const marathonStepByField: Record<UploadFlowIssueField, number> = {
  participantRef: 1,
  participantFirstName: 2,
  participantLastName: 2,
  participantEmail: 2,
  participantPhone: 2,
  competitionClassId: 3,
  deviceGroupId: 4,
}

const byCameraStepByField: Record<UploadFlowIssueField, number> = {
  participantRef: 1,
  participantFirstName: 1,
  participantLastName: 1,
  participantEmail: 1,
  participantPhone: 1,
  competitionClassId: 2,
  deviceGroupId: 2,
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeUploadFlowState(
  state: UploadFlowStateSnapshot,
): NormalizedUploadFlowState {
  return {
    competitionClassId: state.competitionClassId ?? null,
    deviceGroupId: state.deviceGroupId ?? null,
    participantId: state.participantId ?? null,
    participantRef: normalizeText(state.participantRef),
    participantEmail: normalizeText(state.participantEmail),
    participantFirstName: normalizeText(state.participantFirstName),
    participantLastName: normalizeText(state.participantLastName),
    participantPhone: normalizeText(state.participantPhone),
    replaceExistingActiveTopicUpload: state.replaceExistingActiveTopicUpload ?? null,
    uploadInstructionsShown: state.uploadInstructionsShown,
  }
}

function toIssueCode(field: UploadFlowIssueField, value: unknown): UploadFlowIssueCode {
  if (value == null) return "missing"
  if (typeof value === "string" && value.trim().length === 0) return "missing"

  if (field === "participantEmail") {
    return "invalid"
  }

  return "invalid"
}

function toIssueMessageKey(
  field: UploadFlowIssueField,
  code: UploadFlowIssueCode,
): UploadFlowIssueMessageKey {
  if (field === "participantEmail" && code === "invalid") {
    return "invalidParticipantEmail"
  }
  return missingMessageKeyByField[field]
}

function toUploadFlowIssues(
  error: z.ZodError,
  normalizedState: NormalizedUploadFlowState,
  stepByField: Record<UploadFlowIssueField, number>,
): UploadFlowIssue[] {
  const issues: UploadFlowIssue[] = []
  const seenFields = new Set<UploadFlowIssueField>()

  for (const issue of error.issues) {
    const pathField = issue.path[0]
    if (
      typeof pathField !== "string" ||
      !uploadFlowIssueFields.has(pathField as UploadFlowIssueField)
    ) {
      continue
    }

    const field = pathField as UploadFlowIssueField
    if (seenFields.has(field)) continue

    seenFields.add(field)
    const code = toIssueCode(field, normalizedState[field])

    issues.push({
      field,
      code,
      messageKey: toIssueMessageKey(field, code),
      step: stepByField[field],
    })
  }

  return issues
}

function validateStateWithSchema<T extends z.ZodTypeAny>(
  state: UploadFlowStateSnapshot,
  schema: T,
  stepByField: Record<UploadFlowIssueField, number>,
): BuildResult<z.infer<T>> {
  const normalizedState = normalizeUploadFlowState(state)
  const result = schema.safeParse(normalizedState)

  if (result.success) {
    return { ok: true, data: result.data }
  }

  return {
    ok: false,
    issues: toUploadFlowIssues(result.error, normalizedState, stepByField),
  }
}

function mapMarathonInputPayload(data: z.infer<typeof marathonUploadStateSchema>) {
  return {
    reference: data.participantRef,
    firstname: data.participantFirstName,
    lastname: data.participantLastName,
    email: data.participantEmail,
    competitionClassId: data.competitionClassId,
    deviceGroupId: data.deviceGroupId,
    phoneNumber: data.participantPhone ?? undefined,
  }
}

export function getUploadFlowIssueMessageKeys(
  issues: UploadFlowIssue[],
): UploadFlowIssueMessageKey[] {
  return [...new Set(issues.map((issue) => issue.messageKey))]
}

export function validateParticipantIdentity(
  state: UploadFlowStateSnapshot,
): BuildResult<z.infer<typeof participantIdentitySchema>> {
  return validateStateWithSchema(state, participantIdentitySchema, marathonStepByField)
}

export function validateDeviceSelectionRequirements(
  state: UploadFlowStateSnapshot,
  isByCameraMode: boolean,
) {
  if (isByCameraMode) {
    return validateStateWithSchema(state, byCameraDeviceSelectionStateSchema, byCameraStepByField)
  }

  return validateStateWithSchema(state, marathonDeviceSelectionStateSchema, marathonStepByField)
}

export function validateMarathonUploadRequirements(state: UploadFlowStateSnapshot) {
  return validateStateWithSchema(state, marathonUploadStateSchema, marathonStepByField)
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

export function buildInitializeUploadFlowInputResult(
  domain: string,
  state: UploadFlowStateSnapshot,
): BuildResult<{
  domain: string
  reference: string
  firstname: string
  lastname: string
  email: string
  competitionClassId: number
  deviceGroupId: number
  phoneNumber?: string | null
}> {
  const validationResult = validateMarathonUploadRequirements(state)
  if (!validationResult.ok) return validationResult

  return {
    ok: true,
    data: {
      domain,
      ...mapMarathonInputPayload(validationResult.data),
    },
  }
}

export function buildInitializeByCameraUploadInputResult(
  domain: string,
  state: UploadFlowStateSnapshot,
): BuildResult<{
  domain: string
  firstname: string
  lastname: string
  email: string
  deviceGroupId: number
  phoneNumber: string
  replaceExistingActiveTopicUpload?: boolean
}> {
  const validationResult = validateStateWithSchema(
    state,
    byCameraUploadStateSchema,
    byCameraStepByField,
  )
  if (!validationResult.ok) return validationResult

  return {
    ok: true,
    data: {
      domain,
      firstname: validationResult.data.participantFirstName,
      lastname: validationResult.data.participantLastName,
      email: validationResult.data.participantEmail,
      deviceGroupId: validationResult.data.deviceGroupId,
      phoneNumber: validationResult.data.participantPhone,
      replaceExistingActiveTopicUpload:
        validationResult.data.replaceExistingActiveTopicUpload ?? undefined,
    },
  }
}

export function buildPrepareUploadFlowInputResult(
  domain: string,
  state: UploadFlowStateSnapshot,
): BuildResult<{
  domain: string
  reference: string
  firstname: string
  lastname: string
  email: string
  competitionClassId: number
  deviceGroupId: number
  phoneNumber?: string | null
}> {
  const validationResult = validateMarathonUploadRequirements(state)
  if (!validationResult.ok) return validationResult

  return {
    ok: true,
    data: {
      domain,
      ...mapMarathonInputPayload(validationResult.data),
    },
  }
}

export function buildPrepareCompletedSearchParamsResult(
  state: UploadFlowStateSnapshot,
): BuildResult<{
  competitionClassId: number
  deviceGroupId: number
  participantId: number | null
  participantRef: string
  participantEmail: string
  participantFirstName: string
  participantLastName: string
}> {
  const validationResult = validateMarathonUploadRequirements(state)
  if (!validationResult.ok) return validationResult

  return {
    ok: true,
    data: {
      competitionClassId: validationResult.data.competitionClassId,
      deviceGroupId: validationResult.data.deviceGroupId,
      participantId: state.participantId,
      participantRef: validationResult.data.participantRef,
      participantEmail: validationResult.data.participantEmail,
      participantFirstName: validationResult.data.participantFirstName,
      participantLastName: validationResult.data.participantLastName,
    },
  }
}

export function hasParticipantIdentity(state: UploadFlowStateSnapshot) {
  return validateParticipantIdentity(state).ok
}

export function hasDeviceSelectionRequirements(
  state: UploadFlowStateSnapshot,
  isByCameraMode: boolean,
) {
  return validateDeviceSelectionRequirements(state, isByCameraMode).ok
}

export function hasMarathonUploadRequirements(state: UploadFlowStateSnapshot) {
  return validateMarathonUploadRequirements(state).ok
}

export function buildInitializeUploadFlowInput(domain: string, state: UploadFlowStateSnapshot) {
  const result = buildInitializeUploadFlowInputResult(domain, state)
  return result.ok ? result.data : null
}

export function buildInitializeByCameraUploadInput(domain: string, state: UploadFlowStateSnapshot) {
  const result = buildInitializeByCameraUploadInputResult(domain, state)
  return result.ok ? result.data : null
}

export function buildPrepareUploadFlowInput(domain: string, state: UploadFlowStateSnapshot) {
  const result = buildPrepareUploadFlowInputResult(domain, state)
  return result.ok ? result.data : null
}

export function buildPrepareCompletedSearchParams(state: UploadFlowStateSnapshot) {
  const result = buildPrepareCompletedSearchParamsResult(state)
  return result.ok ? result.data : null
}
