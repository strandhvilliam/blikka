import { fail } from "k6"

const PROFILE_LIMITS_PER_MINUTE = {
  smoke: 10,
  main: 300,
  boundary: 400,
  soak: 60,
  replacement: 4,
}

const DEFAULTS = {
  targetBaseUrl: "http://localhost:3000",
  rampProfile: "main",
  testCase: "happy-path",
  maxFinalizationWaitMs: 60_000,
  uploadStatusPollIntervalMs: 3_000,
  participantStatusPollIntervalMs: 5_000,
  productionAck: "",
  testPhonePrefix: "+467000",
  firstName: "Load",
  lastName: "Tester",
  emailDomain: "loadtest.blikka.invalid",
  replacementIterations: 6,
}

const SUPPORTED_TEST_CASES = new Set([
  "happy-path",
  "initialization-only",
  "upload-only",
  "finalization-soak",
  "replacement-correctness",
])

const SUPPORTED_RAMP_PROFILES = new Set([
  "smoke",
  "main",
  "boundary",
  "soak",
  "replacement",
])

function readRequiredEnv(name) {
  const value = (__ENV[name] || "").trim()
  if (!value) {
    fail(`Missing required env var ${name}`)
  }
  return value
}

function readOptionalEnv(name, fallback) {
  const value = (__ENV[name] || "").trim()
  return value || fallback
}

function readOptionalNumberEnv(name, fallback) {
  const raw = (__ENV[name] || "").trim()
  if (!raw) return fallback

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    fail(`Invalid numeric env var ${name}: ${raw}`)
  }
  return parsed
}

function isLocalTarget(url) {
  return (
    url.startsWith("http://localhost") ||
    url.startsWith("http://127.0.0.1") ||
    url.startsWith("https://localhost") ||
    url.startsWith("https://127.0.0.1")
  )
}

function guardProductionTarget(targetBaseUrl) {
  if (isLocalTarget(targetBaseUrl)) return

  if (readOptionalEnv("PRODUCTION_ACK", DEFAULTS.productionAck) !== "I_UNDERSTAND_PRODUCTION_LOAD_TEST") {
    fail(
      "Refusing to target a non-local environment without PRODUCTION_ACK=I_UNDERSTAND_PRODUCTION_LOAD_TEST",
    )
  }
}

function validateProfileRateLimit(rampProfile) {
  const limitPerMinute = PROFILE_LIMITS_PER_MINUTE[rampProfile]
  if (!limitPerMinute) {
    fail(`Unsupported RAMP_PROFILE: ${rampProfile}`)
  }

  const hardCapPerMinute = 400
  if (limitPerMinute > hardCapPerMinute) {
    fail(`RAMP_PROFILE ${rampProfile} exceeds the hard cap of ${hardCapPerMinute}/min`)
  }
}

export const DEFAULT_FIXTURE_RELATIVE_PATHS = [
  "../fixtures/by-camera-12mb-1.jpg",
  "../fixtures/by-camera-12mb-2.jpg",
  "../fixtures/by-camera-12mb-3.jpg",
  "../fixtures/by-camera-12mb-4.jpg",
]

export function getFixturePaths() {
  const explicitSingle = (__ENV.JPEG_FIXTURE_PATH || "").trim()
  if (explicitSingle) {
    return [explicitSingle]
  }
  const explicitMulti = (__ENV.JPEG_FIXTURE_PATHS || "").trim()
  if (explicitMulti) {
    return explicitMulti.split(",").map((s) => s.trim()).filter(Boolean)
  }
  return DEFAULT_FIXTURE_RELATIVE_PATHS
}

export function getFixturePath() {
  return getFixturePaths()[0]
}

export function getConfig() {
  const targetBaseUrl = readOptionalEnv("TARGET_BASE_URL", DEFAULTS.targetBaseUrl).replace(/\/$/, "")
  const marathonDomain = readRequiredEnv("MARATHON_DOMAIN")
  const headerDomain = readOptionalEnv("X_MARATHON_DOMAIN", marathonDomain)
  const deviceGroupId = readOptionalNumberEnv("DEVICE_GROUP_ID", Number.NaN)
  const rampProfile = readOptionalEnv("RAMP_PROFILE", DEFAULTS.rampProfile)
  const testCase = readOptionalEnv("TEST_CASE", DEFAULTS.testCase)

  if (!Number.isFinite(deviceGroupId)) {
    fail("DEVICE_GROUP_ID must be a finite number")
  }

  if (!SUPPORTED_TEST_CASES.has(testCase)) {
    fail(`Unsupported TEST_CASE: ${testCase}`)
  }

  if (!SUPPORTED_RAMP_PROFILES.has(rampProfile)) {
    fail(`Unsupported RAMP_PROFILE: ${rampProfile}`)
  }

  guardProductionTarget(targetBaseUrl)
  validateProfileRateLimit(rampProfile)

  return {
    targetBaseUrl,
    marathonDomain,
    headerDomain,
    deviceGroupId,
    testPhonePrefix: readOptionalEnv("TEST_PHONE_PREFIX", DEFAULTS.testPhonePrefix),
    rampProfile,
    testCase,
    maxFinalizationWaitMs: readOptionalNumberEnv(
      "MAX_FINALIZATION_WAIT_MS",
      DEFAULTS.maxFinalizationWaitMs,
    ),
    uploadStatusPollIntervalMs: readOptionalNumberEnv(
      "UPLOAD_STATUS_POLL_INTERVAL_MS",
      DEFAULTS.uploadStatusPollIntervalMs,
    ),
    participantStatusPollIntervalMs: readOptionalNumberEnv(
      "PARTICIPANT_STATUS_POLL_INTERVAL_MS",
      DEFAULTS.participantStatusPollIntervalMs,
    ),
    firstName: readOptionalEnv("LOAD_TEST_FIRST_NAME", DEFAULTS.firstName),
    lastName: readOptionalEnv("LOAD_TEST_LAST_NAME", DEFAULTS.lastName),
    emailDomain: readOptionalEnv("LOAD_TEST_EMAIL_DOMAIN", DEFAULTS.emailDomain),
    replacementIterations: readOptionalNumberEnv(
      "REPLACEMENT_ITERATIONS",
      DEFAULTS.replacementIterations,
    ),
  }
}
