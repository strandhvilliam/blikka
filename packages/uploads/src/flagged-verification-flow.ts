/**
 * Flagged marathon verification — end-to-end flow and design decisions.
 *
 * ## When this applies
 *
 * Only standard marathons (`mode === 'marathon'`) with `verificationMode === 'flagged'`.
 * Other modes (`all`, `none`) or by-camera marathons use manual verification only; see
 * `resolveMarathonVerificationMode`.
 *
 * ## Pipeline (async tasks)
 *
 * ```
 * Upload completes (KV `finalized`)
 *   → upload-finalizer: persist submissions, settle DB status (`canMarkCompleted: true`)
 *   → validation-runner: run rules, atomic KV decision write, settle DB status (`canMarkCompleted: false`)
 * ```
 *
 * Both tasks may run concurrently after finalize. Settlement is idempotent and monotonic.
 *
 * ## Two stores
 *
 * | Store | Holds | Used for |
 * |-------|--------|----------|
 * | Redis participant state | `validationDecision`, `validated`, `uploadSessionId`, `finalized` | Per-upload-session validation; drives auto-verify in tasks |
 * | Postgres `participants.status` | `initialized` → `completed` → `verified` | Authoritative for admin list badges and filters |
 *
 * ## Validation decisions (KV)
 *
 * - `pending` — set on `initializeState` for a new upload session
 * - `passed` / `flagged` — written atomically by `updateValidationDecisionForSession` (Lua) after rules run
 * - `flagged` is also written when validation throws (fail-safe)
 *
 * ## DB settlement (`settleFinalizedParticipantStatus` in `@blikka/db`)
 *
 * Single entry point for status changes after finalize/validate. Never downgrades `verified` → `completed`.
 *
 * 1. **Auto-verify** — when `verificationMode === 'flagged'` and `validationDecision === 'passed'`:
 *    - Finalizer (`canMarkCompleted: true`): may set `verified` from any non-`verified` status (validation can finish first)
 *    - Validator (`canMarkCompleted: false`): only upgrades `completed` → `verified`
 * 2. **Mark completed** — only when `canMarkCompleted: true` and auto-verify did not apply; skips rows already `completed` or `verified`
 *
 * `flagged` decisions never auto-verify; admins verify manually (batch API) or via existing flows.
 *
 * ## Session safety
 *
 * Every KV write and finalizer settlement checks `uploadSessionId`. If the session changed mid-task
 * (new upload for same reference), settlement is skipped to avoid applying decisions to the wrong upload.
 * `initializeState` deletes and recreates the participant KV key for a new session.
 *
 * ## Finalize bus idempotency (upload processor)
 *
 * After KV is `finalized` for a session, `claimFinalizeEventEmission(domain, ref, uploadSessionId)`
 * (Redis SET NX per session) gates `sendFinalizedEvent`. Duplicate S3/SQS deliveries see
 * `ALREADY_FINALIZED` and skip when the claim already exists. A new `uploadSessionId` uses a new claim
 * key so re-uploads still fan out. Failed bus publishes release the claim for retry.
 *
 * ## Finalizer calls `settleStatus` twice
 *
 * Intentional: validation may write `passed` between the first and second pass, allowing auto-verify in
 * the same finalize handler without waiting for a validation retry.
 *
 * ## Realtime
 *
 * - `participant-validated` / `participant-verified` → admin table refetch (DB status only)
 * - Auto-verify emits `participant-verified` from task handlers when `changedToVerified` is true
 *
 * ## Admin submissions table
 *
 * `getSubmissionDisplayStatus` uses Postgres `status` + marathon `verificationMode` only (no KV on list):
 * `verified` → verified; `completed` with `verificationMode` `all` or `flagged` → needs-verification.
 *
 * @see UploadFinalizer
 * @see ValidationRunner
 * @see ParticipantsRepository.settleFinalizedParticipantStatus
 * @see UploadSessionRepository.updateValidationDecisionForSession
 */

import type { MarathonVerificationMode } from '@blikka/db'

export type MarathonVerificationConfig = {
  readonly mode: string
  readonly verificationMode?: string | null
}

/**
 * Maps marathon config to the verification mode used by finalizer, validator, and settlement.
 *
 * - `flagged` — only `mode === 'marathon'` and `verificationMode === 'flagged'`
 * - `none` — `verificationMode === 'none'` (no auto-verify; manual verify only)
 * - `all` — default when marathon missing or any other configuration
 */
export function resolveMarathonVerificationMode(
  marathon: MarathonVerificationConfig | null | undefined,
): MarathonVerificationMode {
  if (!marathon) {
    return 'all'
  }

  if (marathon.mode === 'marathon' && marathon.verificationMode === 'flagged') {
    return 'flagged'
  }

  if (marathon.verificationMode === 'none') {
    return 'none'
  }

  return 'all'
}
