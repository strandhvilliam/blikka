import { Counter, Rate, Trend } from "k6/metrics"

export const initDuration = new Trend("by_camera_init_duration", true)
export const s3PutDuration = new Trend("by_camera_s3_put_duration", true)
export const finalizationDuration = new Trend("by_camera_finalization_duration", true)
export const endToEndDuration = new Trend("by_camera_end_to_end_duration", true)

export const flowSuccessRate = new Rate("by_camera_flow_success_rate")
export const initFailureRate = new Rate("by_camera_init_failure_rate")
export const s3PutFailureRate = new Rate("by_camera_s3_put_failure_rate")
export const finalizationFailureRate = new Rate("by_camera_finalization_failure_rate")
export const timeoutRate = new Rate("by_camera_timeout_rate")

export const nonFinalizedParticipants = new Counter("by_camera_non_finalized_participants")
export const s3PutFailures = new Counter("by_camera_s3_put_failures")
