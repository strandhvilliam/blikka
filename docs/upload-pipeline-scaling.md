# Upload Pipeline — Caching & Scaling Analysis

Analysis of the S3 `ObjectCreated`-triggered task/worker pipeline, with a focus on a
high-load event: **~600 people each uploading 8–24 photos within ~30 minutes**.

> Status of claims: most points are verified against the code (file refs below). The two
> items previously flagged **[verify]** are now resolved — the zip ECS task did fire per
> finalize (issue #3, fixed), and partial-batch-failure reporting was indeed *not* wired up
> (issue #4, fixed).

## The pipeline

```
S3 ObjectCreated → SQS (UploadProcessorQueue) → upload-processor Lambda
   ├─ per photo: thumbnail (Sharp) + EXIF → S3 + Redis state
   └─ last photo of a participant → atomic finalize → EventBridge bus
                                                          ├→ ValidationQueue
                                                          ├→ SheetGeneratorQueue (Sharp)
                                                          ├→ ZipGeneratorQueue → ECS Fargate task
                                                          └→ UploadFinalizerQueue → Postgres (Neon)
```

- Transient state lives in **Upstash Redis** (REST/HTTP — one round-trip per command).
- Permanent records live in **Neon Postgres** (serverless HTTP driver).

Key files:

- `sst.config.ts` — buckets, queues, bus, subscriptions, concurrency/timeout config
- `tasks/upload-processor/src/handler.ts` — `recordConcurrency: 3`, `inputConcurrency: 2`
- `packages/uploads/src/submission-processor.ts` — per-photo processing + finalize trigger
- `packages/kv-store/src/upload-session-repository.ts` — Redis state, Lua increment, finalize claim
- `packages/uploads/src/participant-finalizer.ts` — DB write path
- `packages/task-runtime/src/lambda.ts` — `makeSqsTask` / `makeSqsRealtimeTask`
- `packages/redis/src/index.ts` — Upstash client
- `packages/api/src/core/upload-flow/public-marathon-cache.ts` — 60s read-path cache

## Load math for this scenario

- 600 people × 8–24 photos = **4,800–14,400 S3 events** over 30 min.
- Average **~3–8 uploads/s**, but uploads are bursty (people cluster; each person fires
  8–24 PUTs near-simultaneously), so realistic **peaks of 30–50 events/s**.
- Each event is one SQS message.
- Per photo, the processor makes **~7 sequential Upstash round-trips**
  (getSubmissionState, getParticipantState, getExif, setExif, updateSubmission,
  increment-Lua, getParticipant) plus 1 S3 GET + 1 S3 PUT. Peak Redis load
  ≈ **200–350 req/s** from the processor alone, before the web read path.

## What's working well

- **SQS as a shock absorber.** S3 → SQS → Lambda means a burst just deepens the queue;
  nothing is dropped if processing lags. The most important design choice, and it's right.
- **Idempotency is solid.** The Lua `incrementParticipantScript` atomically marks processed
  indexes and detects "all done," and `claimFinalizeEventEmission` (SET NX, 30-day TTL)
  guarantees exactly-one finalize event under concurrent photos + SQS retries. Stale-session
  guards (`uploadSessionId` checks) are thorough. The part that usually breaks at scale is
  well-built.
- **Graceful degradation.** Thumbnail and EXIF failures are non-fatal (`catchCause` →
  continue). A corrupt/huge photo won't wedge a participant's finalization.
- **Correct timeout layering.** Visibility timeout (5 min) > Lambda timeout (2 min), so
  in-flight messages aren't double-delivered. DLQs with 5 retries on every queue; bus
  targets get 24 retries / 1 h with their own DLQ.
- **Clean fan-out.** EventBridge separates validation/sheet/zip/finalize, each independently
  retried and dead-lettered.

## What could bite at 600×(8–24)

### 1. No reserved/max concurrency on any Lambda — shared-pool contention — ✅ ADDRESSED
> **Correction to an earlier draft:** the web app is **not** on SST/Lambda (no
> `sst.aws.Nextjs` component, no `output: standalone`), so it does *not* share this pool.
> The contention is purely among the **backend task Lambdas**, which is tighter than it
> sounds: the finalize-side workers that must run right after the processor saturates are
> the exact ones competing with it.

**The mechanism.** Every Lambda in the account+region draws from one default **1,000
concurrent-execution pool**: `upload-processor`, `contact-sheet-generator`,
`upload-finalizer`, `validation-runner`, `zip-worker`, `voting-sms-notifier`. Each SQS event
source scales independently — Lambda starts at ~5 concurrent invocations and ramps **+300/min**
with no ceiling but the account limit. `UploadProcessorQueue` gets slammed first, so it ramps
hardest and, unbounded, eats 600–900 of the pool. When the pool is exhausted, downstream
invocations are **throttled**; a throttled SQS message returns after the visibility timeout and
counts against `maxReceiveCount` (5), so sustained throttling pushes finalize-side messages to
their **DLQs** — i.e. validations/contact-sheets/finalizations silently fail, not just slow.

**Why the cap costs nothing.** A processor invocation handles a batch of 10 with
`recordConcurrency: 3` at ~2–5s/photo, clearing ~0.6–0.7 photos/s. Even peak ~40 photos/s only
needs **~60–100 concurrent invocations**. Letting it scale to 900 buys no throughput and
starves everyone downstream.

**What was changed (see Changelog):**
- **Cap the processor at the event-source level** via SQS `maximumConcurrency: 100`. Preferred
  over reserved concurrency here because, at the cap, Lambda **stops polling** instead of
  invoking-and-throttling — so it does *not* burn `maxReceiveCount`. Messages simply wait in the
  queue (fine; uploads are async).
- **Reserved-concurrency floors** on the four finalize-side functions so they can never be
  starved: sheet-generator 50, finalizer 50, validation 50, zip 20. Reserved concurrency both
  guarantees a floor and caps the function; ~170 reserved leaves ~830 unreserved (AWS requires
  ≥100 unreserved).

**Still to do (ops, not code):**
- Verify the real account ceiling: `aws lambda get-account-settings --query
  'AccountLimit.ConcurrentExecutions'`. If still 1,000, request ~3,000–5,000 via Service Quotas
  as headroom (free). The caps protect against a single runaway function regardless of pool size.
- Add CloudWatch alarms: per-function `Throttles > 0`, and per-queue
  `ApproximateAgeOfOldestMessage` / `ApproximateNumberOfMessagesVisible`. A rising oldest-message
  age on the finalize queues is the early warning that the processor is hogging the pool.
- Not needed: provisioned concurrency (that's for cold-start latency, not throughput contention).

### 2. Sharp memory with no explicit memory setting
Lambda memory isn't configured → SST default (~1024 MB). With `recordConcurrency: 3 ×
inputConcurrency: 2`, up to **6 full-resolution images decode in one Lambda at once**.
24 MP / HEIC photos are heavy in memory — real OOM/slowness risk.
**Fix:** set memory explicitly (1536–3008 MB, which also raises CPU for Sharp) and/or lower
in-Lambda concurrency. Most likely cause of intermittent failures-then-DLQ under big photos.

### 3. Finalize fan-out → ECS Fargate amplification — ✅ ADDRESSED
Confirmed: the zip-generator path launched **one ECS Fargate task per finalize** (zip-worker
Lambda → `task.run(ZipHandlerTask)`), so 600 finalizes ⇒ up to ~600 Fargate launches in 30 min
— Fargate vCPU quota / RunTask throttling, 600 cold starts to do seconds of work, and
per-participant zips that mostly never get downloaded.

**Fix shipped:** removed the eager zip pipeline entirely (bus subscription, `ZipGeneratorQueue`,
its DLQ, the zip-worker Lambda, and the `ZipHandlerTask` ECS task) and moved per-participant zip
generation to **download time, lazily**. The per-participant zip + `zipped_submissions` table are
now an idempotent cache produced on demand by the bulk downloader (generate-on-miss) and the
single-participant endpoint, via the shared `ensureParticipantZip` helper
(`packages/uploads/src/ensure-participant-zip.ts`). Generation concurrency is now bounded by the
download chunking (~a handful of ECS tasks), not 600. See the Changelog and
`/Users/villiamstrandh/.claude/plans/alright-let-s-make-a-agile-kitten.md`.

**Cold-cache downloader memory:** the final chunk archive is now **streamed to S3 via multipart
upload** (`S3Service.uploadStream` → `@aws-sdk/lib-storage`) instead of `Buffer.concat`, so the
combined zip is never fully buffered — removing the largest allocation (~one full copy of the
archive). What remains in memory is `allFiles` (the chunk's decompressed photos) plus small
in-flight upload parts; chunk size is also capped at 100 as a guard. Streaming generation
(returning the freshly-built buffer to skip the re-download) is the remaining lever if needed.

**Other open risks to watch:** Vercel `maxDuration` for the single-participant inline build;
benign duplicate `zipped_submissions` rows under concurrent ensures.

### 4. SQS batch partial-failure semantics — ✅ ADDRESSED
**Verified:** it was *not* wired up. `makeSqsTask`/`makeSqsRealtimeTask` ran `Effect.forEach`
over the batch and failed the whole effect on the first failing record, and `makeLambdaHandler`
(`LambdaHandler.make`) returns `void` — no `SQSBatchResponse`. So **one poison photo in a batch
of 10 redelivered all 10**, reprocessed up to 5× before DLQ. Idempotency kept it correct but it
multiplied Redis/S3/Sharp load exactly when the system was already hot.

**Fix shipped (see Changelog):** the two shared SQS task constructors now process each record
independently — a failing record (decode *or* `run` error) is logged and its `messageId` is
collected — and return a partial-batch `SQSBatchResponse` (`{ batchItemFailures: [...] }`) instead
of failing the whole effect. The four affected event-source mappings (`UploadProcessorQueue`,
`SheetGeneratorQueue`, `UploadFinalizerQueue`, `ValidationQueue`) now set `ReportBatchItemFailures`,
so AWS redelivers **only** the failed messages.

> These two changes are coupled and must ship together: returning `batchItemFailures` *without*
> `ReportBatchItemFailures` on the ESM would make AWS treat a non-throwing invocation as full
> success and delete the failed messages too (silent data loss). The bespoke `voting-sms-notifier`
> handler is intentionally left as-is (it still fails the whole batch and its queue does **not**
> set `ReportBatchItemFailures`, so it stays consistent).

### 5. Upstash request volume & sequential latency
~7 non-pipelined round-trips per photo means (a) request-rate pressure against the Upstash
plan's per-second/connection limits at peak, and (b) per-photo latency = 7 × RTT, which
lengthens Lambda duration and forces more concurrency. The two independent reads in
`resolveReadySubmissionContext` (submission + participant `hgetall`) could be pipelined.
**Fix:** check Upstash plan ceilings against ~300+ req/s; pipeline the independent reads.

### 6. Finalizer DB amplification
Per finalize: `getMarathonByDomain` (uncached on this path), `getParticipant`,
`updateAllSubmissions`, then `settleStatus` **twice** — each a separate Neon HTTP query,
×600 in a burst. Neon autoscales, but it's many small round-trips plus possible compute
cold-start.
**Fix:** cache marathon-by-domain; collapse the intentional double-settle.

### 7. Cache stampede on `public-marathon-cache` (60 s TTL, no single-flight)
600 clients polling the same domain all miss simultaneously every 60 s → synchronized DB
spikes.
**Fix:** add jitter / stale-while-revalidate / single-flight.

## Priorities

1. ~~Set Lambda memory + reserved concurrency on upload-processor.~~ ✅ done (see Changelog).
2. ~~Confirm/limit the per-finalize ECS zip fan-out.~~ ✅ done — eager zip pipeline removed,
   generation moved to lazy download-time (see Changelog).
3. ~~Verify partial-batch-failure reporting.~~ ✅ done — was not wired up; now returns
   `SQSBatchResponse` + `ReportBatchItemFailures` on the affected ESMs (see Changelog).
4. Redis pipelining + marathon caching (efficiency wins).

## Changelog

### 2026-06-14 — SQS partial-batch failures (issue #4)

Stopped one poison record from dragging its whole batch (up to 10) through repeated
redeliveries to the DLQ.

| Area | Change |
|---|---|
| `packages/task-runtime/src/lambda.ts` | Added `processRecordsWithPartialFailures`: runs each record through `Effect.catchCause`, logs + collects the `messageId` of any failure, and returns `{ batchItemFailures }` (`SQSBatchResponse`). Both `makeSqsTask` and `makeSqsRealtimeTask` now delegate to it instead of `Effect.forEach`-then-fail-fast. `catchCause` (not `catch`) isolates defects too, so a record that *dies* still fails alone rather than crashing the whole invocation |
| `sst.config.ts` | Enabled SST's first-class `batch: { partialResponses: true }` (which sets the ESM's `functionResponseTypes = ['ReportBatchItemFailures']`) on `SheetGeneratorQueue`, `UploadFinalizerQueue`, `ValidationQueue`, and `UploadProcessorQueue` (spread alongside the existing `maximumConcurrency` transform, which has no first-class option) |

Granularity is per-SQS-message (the redeliverable unit): if any decoded input within a record
fails, that whole record is reported failed and redelivered — idempotency makes the
already-succeeded inputs safe to re-run. Infra-level failures before the per-record loop (service
acquisition) still fail the whole invocation, so the whole batch retries — correct.

Out of scope: the bespoke `voting-sms-notifier` handler keeps fail-the-whole-batch semantics and
its queue does **not** enable `ReportBatchItemFailures` (the two must stay paired).

Not added: a unit test for the new helper — `@blikka/task-runtime` has no test setup and importing
`lambda.ts` transitively pulls `@blikka/telemetry`, which vitest can't resolve (no `exports` entry).
Behavior was verified by `tsc` + manual review; wiring a test would mean unrelated package changes.

### 2026-06-13 — Concurrency partitioning (issue #1) — `sst.config.ts`

| Function | Change | Rationale |
|---|---|---|
| `upload-processor` | SQS `maximumConcurrency: 100` (ESM transform); `memory: '2048 MB'` | Cap runaway scaling without burning SQS receive count; Sharp headroom (also addresses #2) |
| `contact-sheet-generator` | `concurrency: { reserved: 50 }` | Guaranteed floor; can't be starved |
| `upload-finalizer` | `concurrency: { reserved: 50 }` | Guaranteed floor for DB-write finalize |
| `validation-runner` | `concurrency: { reserved: 50 }` | Guaranteed floor for validation |
| `zip-worker` | `concurrency: { reserved: 20 }` | Small floor; mostly orchestrates an ECS task |

Net pool: ~170 reserved + processor capped at 100 (ESM cap does not subtract from the pool),
leaving ~830 unreserved. No application logic touched. Not yet applied: account-limit increase
and CloudWatch alarms (ops tasks, see issue #1).

> Note: the `zip-worker` reserved-concurrency floor above was superseded by issue #3 — the
> zip-worker function no longer exists.

### 2026-06-13 — Lazy per-participant zips (issue #3)

Removed the eager per-finalize zip generation and moved it to download time.

| Area | Change |
|---|---|
| `packages/uploads/src/ensure-participant-zip.ts` | New idempotent `ensureParticipantZip` helper (replaces `zip-worker.ts`): cache hit (row + S3 object) → no-op; miss → build from originals, upload, insert row (skip insert on cache-repair) |
| `packages/db/.../zipped-submissions.repository.ts` | New `getCompletedParticipantsForZipPlanning` (planning source) + `getParticipantReferencesInRange` (downloader enumeration) |
| `packages/api/.../zip-files/service.ts` | Plan chunks from completed participants (not `zipped_submissions`); single-participant download generates on demand; `MAX_PARTICIPANTS_PER_ZIP` 200→100 |
| `tasks/zip-downloader/src/index.ts` | Enumerate participants by range; `ensureParticipantZip` per participant (generate-on-miss) with per-participant failure isolation; concurrency 5→3; **stream the chunk archive to S3 via multipart instead of `Buffer.concat`** |
| `packages/aws/src/s3-service.ts` | New `uploadStream(bucket, key, body, opts?)` — multipart upload of a `Readable` via `@aws-sdk/lib-storage` (added dep), so large archives never buffer fully in memory |
| `sst.config.ts` | Deleted `ZipHandlerTask`, `ZipGeneratorQueue`, `ZipWorkerDLQ`, the zip-worker subscribe, and `ZipGeneratorBusSubscription`; added `submissionsBucket` to `ZipDownloaderTask` link |
| `tasks/zip-worker/` | Deleted; `'zip-generated'` realtime event removed (no subscribers) |

Tests: rewrote `ensure-participant-zip.test.ts` (cache hit/miss/repair) and updated
`zip-files/service.test.ts`; all pass. Pre-existing unrelated failures
(`initialize-marathon-upload`, `submission-processor`) are date/flaky, confirmed on clean HEAD.

Cleanup: removed the now-dead `getZippedSubmissionsByReferenceRange` /
`getZippedSubmissionsByDomain` methods (and their orphaned `ZippedSubmissionWithParticipant` /
`ParticipantWithCompetitionClass` types) from `ZippedSubmissionsRepository`.

### 2026-06-13 — Export UI rebuilt around the lazy model (file-list state)

The old export UI modelled a monolithic export with a "readiness gate" that blocked starting
until every participant had a pre-generated zip — impossible under lazy generation (the Start
button was permanently disabled). Replaced it with a **per-file (per-chunk) live model**:

Backend:
- `download-state-repository` + `atomic-increment-completed-script`: track `completedJobIds` (mirror
  of `failedJobIds`); `atomicIncrementCompleted(processId, total, jobId)` now records which chunk.
  New robust readers `getCompletedJobIds` / `getFailedJobIds` / `getProcessSummary`, and
  `reactivateChunkForRetry` + `atomic-retry-chunk-script` (un-fail a chunk, flip process to
  `processing`).
- `zip-files/service`: `getExportFiles` (single source — per-chunk rows: class, ref range, status
  `building|ready|failed`, **presigned URL the moment a chunk is ready → download-as-ready**),
  `retryExportChunk` (re-queue one failed chunk's ECS job), `getExportPreview` (status-based
  pre-flight: completed participants / classes / estimated files). New tRPC procedures for each.

Frontend (`dashboard/export`): replaced the readiness→generate→download stepper with one panel —
pre-flight summary + **Build archives**, then a class-grouped live file list where each row goes
Building ◐ → Ready ● (Download) / Failed ✕ (Retry), plus aggregate progress + Cancel / Create-new.
Deleted the obsolete `use-zip-export-process`, `zip-export-phase` (+ its test), `status-display`,
`progress-display`, `zip-export-step-indicator`, `zip-download-files-list`. This also fixes the
false-stall warning (no more 2-min stall heuristic) and the "packed photo folder" copy.

**Post-review hardening (`tasks/zip-downloader/src/index.ts`):**
- Per-participant failures are now collected as tagged ok/failure results; if **any** participant
  fails, the whole chunk is failed (`Effect.fail` → `handleJobFailure` → `atomicIncrementFailed`)
  instead of silently shipping a partial archive that reports as `completed`. Every failing
  reference is logged + named in the chunk error.
- Stream teardown made crash-safe: an `archive.on('error', …)` listener prevents an archiver
  error from becoming an unhandled `'error'` event (task crash), and an `Effect.ensuring`
  finalizer destroys the archive on any outcome — in particular when the **upload** side fails and
  the producer would otherwise leave the stream undrained.

Still-open review findings (not yet addressed): transient S3 `getHead` error treated as a cache
miss → rebuild; duplicate `zipped_submissions` rows possible under concurrent ensures (no unique
constraint); the admin single-download UI still gates on a pre-existing zip row (`hasZip`), so the
new on-demand path is unreachable from that button; `getParticipantByReference` over-fetch.
