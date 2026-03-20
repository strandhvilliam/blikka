import { describe, expect, it } from "vitest"

import type { UploadFlowStateSnapshot } from "./upload-flow-state"
import {
  buildInitializeByCameraUploadInputResult,
  buildInitializeUploadFlowInputResult,
  buildPrepareCompletedSearchParamsResult,
  buildPrepareUploadFlowInputResult,
  getUploadFlowIssueMessageKeys,
  toParticipantFlowStatePatch,
  validateMarathonUploadRequirements,
} from "./upload-flow-state"

function createValidMarathonState(
  overrides: Partial<UploadFlowStateSnapshot> = {},
): UploadFlowStateSnapshot {
  return {
    competitionClassId: 2,
    deviceGroupId: 7,
    participantId: 99,
    participantRef: "0042",
    participantEmail: "user@example.com",
    participantFirstName: "James",
    participantLastName: "Bond",
    participantPhone: null,
    replaceExistingActiveTopicUpload: null,
    uploadInstructionsShown: false,
    ...overrides,
  }
}

describe("upload-flow-state", () => {
  it("accepts marathon initialize payload without phone number", () => {
    const result = buildInitializeUploadFlowInputResult(
      "demo-domain",
      createValidMarathonState(),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.reference).toBe("0042")
    expect(result.data.phoneNumber).toBeUndefined()
  })

  it("returns by-camera issues for missing phone and device", () => {
    const result = buildInitializeByCameraUploadInputResult(
      "demo-domain",
      createValidMarathonState({
        deviceGroupId: null,
        participantPhone: null,
      }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    const messageKeys = getUploadFlowIssueMessageKeys(result.issues)
    expect(messageKeys).toEqual(
      expect.arrayContaining(["missingPhoneNumber", "missingDeviceSelection"]),
    )
  })

  it("normalizes whitespace-only values and reports them as missing", () => {
    const result = buildPrepareUploadFlowInputResult(
      "demo-domain",
      createValidMarathonState({
        participantRef: "   ",
      }),
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(
      result.issues.some(
        (issue) => issue.field === "participantRef" && issue.code === "missing",
      ),
    ).toBe(true)
  })

  it("builds completed search params when marathon state is valid", () => {
    const result = buildPrepareCompletedSearchParamsResult(
      createValidMarathonState({
        participantId: 1337,
      }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data).toEqual({
      competitionClassId: 2,
      deviceGroupId: 7,
      participantId: 1337,
      participantRef: "0042",
      participantEmail: "user@example.com",
      participantFirstName: "James",
      participantLastName: "Bond",
    })
  })

  it("reports validation ok for marathon initialize and not ok for invalid by-camera", () => {
    const invalidByCamera = createValidMarathonState({
      participantPhone: null,
    })

    expect(
      buildInitializeByCameraUploadInputResult("demo-domain", invalidByCamera).ok,
    ).toBe(false)

    expect(
      buildInitializeUploadFlowInputResult("demo-domain", createValidMarathonState()).ok,
    ).toBe(true)
    expect(validateMarathonUploadRequirements(createValidMarathonState()).ok).toBe(true)
  })

  it("trims phone and converts empty values to null in participant patch", () => {
    const patch = toParticipantFlowStatePatch(
      {
        firstname: "Jane",
        lastname: "Doe",
        email: "jane@example.com",
        phone: "   ",
      },
      { trimPhone: true },
    )

    expect(patch.participantPhone).toBeNull()
  })
})
