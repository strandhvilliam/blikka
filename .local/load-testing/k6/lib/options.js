import { fail } from "k6"
import { getConfig } from "./config.js"

const config = getConfig()

function buildArrivalRateScenario(exec, stages, preAllocatedVUs, maxVUs, tags = {}) {
  return {
    executor: "ramping-arrival-rate",
    exec,
    startRate: stages[0]?.target ?? 1,
    timeUnit: "1m",
    preAllocatedVUs,
    maxVUs,
    stages,
    tags,
  }
}

function buildSharedIterationsScenario(exec, iterations, vus, tags = {}) {
  return {
    executor: "shared-iterations",
    exec,
    vus,
    iterations,
    maxDuration: "15m",
    tags,
  }
}

function buildStagesForProfile(profile) {
  switch (profile) {
    case "smoke":
      return [
        { duration: "30s", target: 100 },
        { duration: "1m", target: 250 },
        { duration: "15s", target: 0 },
      ]
    case "main":
      return [
        { duration: "2m", target: 200 },
        { duration: "2m", target: 250 },
        { duration: "10m", target: 300 },
        { duration: "2m", target: 0 },
      ]
    case "boundary":
      return [
        { duration: "90s", target: 350 },
        { duration: "3m", target: 400 },
        { duration: "90s", target: 0 },
      ]
    case "soak":
      return [
        { duration: "2m", target: 30 },
        { duration: "20m", target: 60 },
        { duration: "2m", target: 0 },
      ]
    default:
      fail(`Unsupported profile for arrival-rate execution: ${profile}`)
  }
}

function buildThresholds(testCase, rampProfile) {
  const isMainHappyPath = testCase === "happy-path" && rampProfile === "main"

  const thresholds = {
    http_req_failed: ["rate<0.03"],
    by_camera_init_failure_rate: [
      { threshold: "rate<0.03", abortOnFail: true, delayAbortEval: "2m" },
    ],
    by_camera_s3_put_failure_rate: [
      { threshold: "rate<0.03", abortOnFail: true, delayAbortEval: "2m" },
    ],
    by_camera_finalization_failure_rate: [
      { threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "2m" },
    ],
    by_camera_timeout_rate: [{ threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "2m" }],
  }

  if (isMainHappyPath) {
    thresholds.by_camera_flow_success_rate = ["rate>=0.99"]
    thresholds.by_camera_init_duration = ["p(95)<1500"]
    thresholds.by_camera_s3_put_duration = ["p(95)<10000"]
    thresholds.by_camera_end_to_end_duration = ["p(95)<60000"]
  }

  return thresholds
}

function buildScenario() {
  switch (config.testCase) {
    case "happy-path":
      return buildArrivalRateScenario(
        "runHappyPath",
        buildStagesForProfile(config.rampProfile),
        450,
        900,
        { test_case: config.testCase, ramp_profile: config.rampProfile },
      )
    case "initialization-only":
      return buildArrivalRateScenario(
        "runInitializationOnly",
        buildStagesForProfile(config.rampProfile === "replacement" ? "smoke" : config.rampProfile),
        300,
        600,
        { test_case: config.testCase, ramp_profile: config.rampProfile },
      )
    case "upload-only":
      return buildArrivalRateScenario(
        "runUploadOnly",
        buildStagesForProfile(config.rampProfile === "replacement" ? "smoke" : config.rampProfile),
        400,
        800,
        { test_case: config.testCase, ramp_profile: config.rampProfile },
      )
    case "finalization-soak":
      return buildArrivalRateScenario(
        "runFinalizationSoak",
        buildStagesForProfile(config.rampProfile === "main" ? "soak" : config.rampProfile),
        180,
        360,
        { test_case: config.testCase, ramp_profile: config.rampProfile },
      )
    case "replacement-correctness":
      return buildSharedIterationsScenario(
        "runReplacementCorrectness",
        config.replacementIterations,
        Math.min(Math.max(config.replacementIterations, 1), 8),
        { test_case: config.testCase, ramp_profile: "replacement" },
      )
    default:
      fail(`Unsupported TEST_CASE: ${config.testCase}`)
  }
}

export const options = {
  scenarios: {
    primary: buildScenario(),
  },
  thresholds: buildThresholds(config.testCase, config.rampProfile),
  userAgent: "blikka-k6-load-test/1.0",
}
