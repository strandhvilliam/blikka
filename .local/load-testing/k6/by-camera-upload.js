import exec from "k6/execution"
import { fail, sleep } from "k6"
import { options } from "./lib/options.js"
import { getConfig, getFixturePaths } from "./lib/config.js"
import {
  endToEndDuration,
  finalizationDuration,
  finalizationFailureRate,
  flowSuccessRate,
  initDuration,
  initFailureRate,
  nonFinalizedParticipants,
  s3PutDuration,
  s3PutFailureRate,
  s3PutFailures,
  timeoutRate,
} from "./lib/metrics.js"
import { putPresignedUpload, trpcMutation, trpcQuery } from "./lib/trpc.js"

export { options }

const config = getConfig()
const jpegFixtures = getFixturePaths().map((fixturePath) => open(fixturePath, "b"))
const JPEG_CONTENT_TYPE = "image/jpeg"
let activeTopicOrderIndex = null

function pickJpegFixtureBytes() {
  if (!jpegFixtures.length) {
    fail("No JPEG fixtures configured (getFixturePaths returned empty)")
  }
  const vuIndex = exec.vu.idInTest - 1
  const slot = (vuIndex + exec.scenario.iterationInTest) % jpegFixtures.length
  return jpegFixtures[slot]
}

function nowMs() {
  return Date.now()
}

function getIterationId() {
  return `${exec.scenario.name}-${exec.vu.idInTest}-${exec.scenario.iterationInTest}`
}

function sanitizePhonePrefix(prefix) {
  const trimmed = prefix.trim()
  if (!trimmed.startsWith("+")) {
    fail("TEST_PHONE_PREFIX must be in E.164 format and start with '+'")
  }
  return trimmed
}

function buildIdentity(iterationSeed) {
  const numericSeed = String(iterationSeed).replace(/\D/g, "").slice(-9).padStart(9, "0")
  const phoneNumber = `${sanitizePhonePrefix(config.testPhonePrefix)}${numericSeed}`
  const emailToken = numericSeed

  return {
    phoneNumber,
    email: `by-camera-${emailToken}@${config.emailDomain}`,
    firstname: config.firstName,
    lastname: config.lastName,
  }
}

function resolveByPhone(identity) {
  return trpcMutation(
    config,
    "uploadFlow.resolveByCameraParticipantByPhone",
    {
      domain: config.marathonDomain,
      phoneNumber: identity.phoneNumber,
    },
    { step: "resolve" },
  )
}

function initializeByCameraUpload(identity, replaceExistingActiveTopicUpload = false) {
  return trpcMutation(
    config,
    "uploadFlow.initializeByCameraUpload",
    {
      domain: config.marathonDomain,
      firstname: identity.firstname,
      lastname: identity.lastname,
      email: identity.email,
      deviceGroupId: config.deviceGroupId,
      phoneNumber: identity.phoneNumber,
      uploadContentTypes: [JPEG_CONTENT_TYPE],
      uploadExif: [null],
      replaceExistingActiveTopicUpload,
    },
    { step: "initialize" },
  )
}

function getActiveTopicOrderIndex() {
  if (activeTopicOrderIndex !== null) {
    return activeTopicOrderIndex
  }

  const marathon = trpcQuery(
    config,
    "uploadFlow.getPublicMarathon",
    {
      domain: config.marathonDomain,
    },
    { step: "active_topic" },
  ).data

  const activeTopic = marathon?.topics?.[0]
  if (typeof activeTopic?.orderIndex !== "number") {
    fail("getPublicMarathon returned no active by-camera topic order index")
  }

  activeTopicOrderIndex = activeTopic.orderIndex
  return activeTopicOrderIndex
}

function performInitialization(identity, replaceExistingActiveTopicUpload = false) {
  const initStartedAt = nowMs()

  try {
    const initialization = initializeByCameraUpload(identity, replaceExistingActiveTopicUpload)
    initDuration.add(nowMs() - initStartedAt)

    if (!initialization.data?.uploads?.length) {
      fail("initializeByCameraUpload returned no uploads")
    }

    initFailureRate.add(false)
    return initialization.data
  } catch (error) {
    initDuration.add(nowMs() - initStartedAt)
    initFailureRate.add(true)
    throw error
  }
}

function getUploadStatus(reference, activeTopicOrderIndex) {
  return trpcQuery(
    config,
    "uploadFlow.getUploadStatus",
    {
      domain: config.marathonDomain,
      reference,
      orderIndexes: [activeTopicOrderIndex],
    },
    { step: "upload_status" },
  )
}

function getParticipant(reference) {
  return trpcQuery(
    config,
    "participants.getPublicParticipantByReference",
    {
      domain: config.marathonDomain,
      reference,
    },
    { step: "participant_status" },
  )
}

function uploadSingleFile(uploadInfo) {
  const uploadStartedAt = nowMs()
  const response = putPresignedUpload(
    config,
    uploadInfo.url,
    pickJpegFixtureBytes(),
    JPEG_CONTENT_TYPE,
    { submission_key: uploadInfo.key },
  )
  const duration = nowMs() - uploadStartedAt
  s3PutDuration.add(duration)

  if (response.status < 200 || response.status >= 300) {
    s3PutFailures.add(1)
    s3PutFailureRate.add(true)
    fail(`S3 PUT failed with status ${response.status} for ${uploadInfo.key}`)
  }

  s3PutFailureRate.add(false)
}

function waitForFinalization(reference) {
  const startedAt = nowMs()
  const activeTopicOrderIndex = getActiveTopicOrderIndex()
  let lastUploadStatus = null
  let lastParticipant = null

  while (nowMs() - startedAt < config.maxFinalizationWaitMs) {
    const uploadStatus = getUploadStatus(reference, activeTopicOrderIndex).data
    lastUploadStatus = uploadStatus

    if (uploadStatus.participant?.errors?.length) {
      fail(`Participant finalization reported errors: ${uploadStatus.participant.errors.join(", ")}`)
    }

    if (uploadStatus.participant?.finalized) {
      return {
        uploadStatus,
        participant: lastParticipant,
        durationMs: nowMs() - startedAt,
      }
    }

    if (
      uploadStatus.submissions.some(
        (submission) =>
          submission.uploaded &&
          (submission.exifProcessed || submission.thumbnailKey !== null),
      )
    ) {
      const participant = getParticipant(reference).data
      lastParticipant = participant

      if (participant.status === "completed" || participant.status === "verified") {
        return {
          uploadStatus,
          participant,
          durationMs: nowMs() - startedAt,
        }
      }
    }

    sleep(Math.min(config.uploadStatusPollIntervalMs, config.participantStatusPollIntervalMs) / 1000)
  }

  timeoutRate.add(true)
  nonFinalizedParticipants.add(1)
  fail(
    `Finalization timed out for ${reference}. Last participant status: ${lastParticipant?.status ?? "unknown"}; last session finalized: ${lastUploadStatus?.participant?.finalized ?? "unknown"}`,
  )
}

function performFinalizationWait(reference) {
  try {
    const finalized = waitForFinalization(reference)
    timeoutRate.add(false)
    finalizationFailureRate.add(false)
    return finalized
  } catch (error) {
    finalizationFailureRate.add(true)
    throw error
  }
}

function runHappyPathFlow(identity) {
  const startedAt = nowMs()

  const resolveResult = resolveByPhone(identity)
  if (resolveResult.data.match) {
    fail(`Expected no pre-existing participant for ${identity.phoneNumber}`)
  }

  const initialization = performInitialization(identity, false)

  uploadSingleFile(initialization.uploads[0])

  const finalized = performFinalizationWait(initialization.reference)
  finalizationDuration.add(finalized.durationMs)
  endToEndDuration.add(nowMs() - startedAt)

  return {
    reference: initialization.reference,
    participantId: initialization.participantId,
  }
}

function runInitializationOnlyFlow(identity) {
  const resolveResult = resolveByPhone(identity)
  if (resolveResult.data.match) {
    fail(`Expected no pre-existing participant for ${identity.phoneNumber}`)
  }

  performInitialization(identity, false)
}

function runUploadOnlyFlow(identity) {
  const resolveResult = resolveByPhone(identity)
  if (resolveResult.data.match) {
    fail(`Expected no pre-existing participant for ${identity.phoneNumber}`)
  }

  const initialization = performInitialization(identity, false)
  uploadSingleFile(initialization.uploads[0])
}

function runReplacementCorrectnessFlow(identity) {
  const baseline = runHappyPathFlow(identity)
  const resolution = resolveByPhone(identity)

  if (!resolution.data.match || resolution.data.activeTopicUploadState !== "already-uploaded") {
    fail(
      `Expected already-uploaded state for ${identity.phoneNumber}, got ${JSON.stringify(resolution.data)}`,
    )
  }

  let guardedInitializationFailed = false
  try {
    initializeByCameraUpload(identity, false)
  } catch (_error) {
    guardedInitializationFailed = true
  }

  if (!guardedInitializationFailed) {
    fail("Expected replaceExistingActiveTopicUpload=false to fail for an already-uploaded participant")
  }

  const replacementInitialization = performInitialization(identity, true)
  uploadSingleFile(replacementInitialization.uploads[0])
  const finalized = performFinalizationWait(replacementInitialization.reference)
  finalizationDuration.add(finalized.durationMs)

  return baseline
}

function executeFlow(flow) {
  try {
    const result = flow()
    flowSuccessRate.add(true)
    return result
  } catch (error) {
    flowSuccessRate.add(false)
    throw error
  }
}

export function runHappyPath() {
  const identity = buildIdentity(getIterationId())
  executeFlow(() => runHappyPathFlow(identity))
}

export function runInitializationOnly() {
  const identity = buildIdentity(getIterationId())
  executeFlow(() => runInitializationOnlyFlow(identity))
}

export function runUploadOnly() {
  const identity = buildIdentity(getIterationId())
  executeFlow(() => runUploadOnlyFlow(identity))
}

export function runFinalizationSoak() {
  const identity = buildIdentity(getIterationId())
  executeFlow(() => runHappyPathFlow(identity))
}

export function runReplacementCorrectness() {
  const identity = buildIdentity(`replacement-${getIterationId()}`)
  executeFlow(() => runReplacementCorrectnessFlow(identity))
}
