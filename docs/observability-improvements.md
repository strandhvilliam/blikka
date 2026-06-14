# Observability Improvements — Upload Flow

How to make a **live event** (e.g. ~600 people each uploading 8–24 photos in ~30 min)
observable: easy to trace what is happening, and to see fast when something has gone wrong.

> Companion to `docs/upload-pipeline-scaling.md` (load/scaling analysis). That doc fixed the
> _throughput_ risks; this one covers _visibility_ into the same pipeline.

## The pipeline (recap)

```
S3 ObjectCreated → SQS (UploadProcessorQueue) → upload-processor Lambda
   ├─ per photo: thumbnail (Sharp) + EXIF → S3 + Redis state
   └─ last photo of a participant → atomic finalize → EventBridge bus
                                                          ├→ ValidationQueue       → validation-runner
                                                          ├→ SheetGeneratorQueue    → contact-sheet-generator
                                                          └→ UploadFinalizerQueue   → upload-finalizer → Postgres
```

## What exists today

The foundation is solid:

- **OpenTelemetry → Axiom** (`packages/telemetry/src/index.ts`): OTLP traces (`BatchSpanProcessor`)
  and OTLP logs (`SimpleLogRecordProcessor`), dataset `blikka`, service name
  `blikka-{env}-{taskName}`.
- **Logs joined to traces.** `addTraceDataToLoggers` stamps `traceId`/`spanId` onto every log
  line, so a log and its span are cross-linkable in Axiom.
- **Consistent log annotation.** Handlers `Effect.annotateLogs({ ...input })`; the KV repo names
  its own spans (`UploadSessionRepository.*`) and annotates `domain`/`reference`/`orderIndex`.
- **User-facing progress stream.** `withEventResult` (`packages/realtime`) emits per-stage
  success/error + duration to domain/participant realtime channels — this powers the live UI.
- **Failure containment.** DLQs on every queue; SQS partial-batch failures; graceful degradation
  on thumbnail/EXIF.

## Core problem: you cannot follow one participant end-to-end

The per-record logs are good. Everything _above_ a single record is missing. The question you
actually ask during a live event — _"participant REF123 isn't finalizing, where is it stuck?"_ —
cannot be answered from one place today, for three compounding reasons:

1. **Traces break at every async hop.** Each Lambda starts a fresh root span
   (`Effect.withSpan(options.spanName)`, `packages/task-runtime/src/lambda.ts`). Nothing carries
   trace context across S3→SQS→processor→EventBridge→finalizer/validation/sheet. The
   `FinalizedEventSchema` (`packages/aws/src/bus-service.ts`) carries only
   `{domain, reference, uploadSessionId}` — no `traceparent`. A single participant's journey is
   scattered across a dozen disconnected root traces.
2. **Business IDs live on logs, not spans.** There is no `annotateCurrentSpan`/span-attribute
   equivalent of the ubiquitous `annotateLogs`. In Axiom's _trace_ view you cannot filter or group
   by `domain` / `reference` / `uploadSessionId`.
3. **There are zero metrics.** `Effect.Metric` usage across `packages` + `tasks` is nil.
   Everything is traces + logs. During a 600-person burst, traces are the wrong tool — you need
   counters and gauges (rate, backlog, error %), and there are none.

## Improvements (prioritized)

### P0 — Correlation + alarms (highest leverage, cheap) — ✅ IMPLEMENTED

The two changes that give most of the live-ops value with no business-logic risk.

**P0.1 — Stamp business attributes on spans.** At the task boundary
(`makeSqsTask`/`makeSqsRealtimeTask`), set `blikka.task`, `blikka.domain`, `blikka.reference`,
`blikka.order_index`, and `messaging.message_id` as **span attributes** (not just log fields).
Annotate `blikka.upload_session_id` deeper where it is known (`SubmissionProcessor.process` once
KV is resolved; `UploadFinalizer.finalize` from its input). Now `domain`+`reference` (the
participant) and `uploadSessionId` (the specific upload attempt) are filterable across every span
of every stage in Axiom — even before true trace linkage (P2.2) exists.

> Implementation note: inside `SubmissionProcessor.process` / `UploadFinalizer.finalize` the
> attributes are set with `Effect.annotateCurrentSpan` **from inside the fn body**, not via a
> trailing `Effect.fn` transform. `Effect.fn` applies trailing pipeables to the body and only then
> wraps the result in its span, so an `Effect.annotateSpans` transform would annotate child spans
> but never the fn's own span.

**P0.2 — CloudWatch alarms** in `sst.config.ts` → a single SNS topic (`ObservabilityAlertsTopic`):

| Alarm                                        | Metric                                           | Why                                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLQ not empty (each of 6 DLQs)               | `AWS/SQS ApproximateNumberOfMessagesVisible ≥ 1` | A message in a DLQ = a silently-failed photo/finalize/validation. The #1 "something is wrong" signal.                                                                                                                                                                                         |
| Queue backlog (finalizer, validation, sheet) | `AWS/SQS ApproximateAgeOfOldestMessage > 5 min`  | Oldest-message age rising on finalize-side queues = the processor is hogging the concurrency pool. Early warning. Deliberately **not** on the upload-processor queue, which is capped and designed to queue during a burst — an age alarm there would false-fire during a healthy live event. |
| Function throttled (each subscriber)         | `AWS/Lambda Throttles ≥ 1`                       | Concurrency starvation; precedes DLQ growth.                                                                                                                                                                                                                                                  |
| Function errors (each subscriber)            | `AWS/Lambda Errors` over threshold               | Broad regression signal.                                                                                                                                                                                                                                                                      |

> The SNS topic is created with no subscription. Subscribe an email/Slack/PagerDuty endpoint
> (console or `aws sns subscribe`) to actually receive alerts; until then the alarms are still
> visible in the CloudWatch console.

### P1 — Metrics + a live dashboard

Wire an OTel **metric reader** into `TelemetryLayer` (NodeSdk supports `metricReader`) and add
`Effect.Metric` instruments, exported to Axiom:

- `photos_processed` (counter, tag `domain`), `photo_processing_duration` (histogram),
  `participants_finalized` (counter), `validation_outcome` (counter, tag pass/fail).
- **Degradation counters** — `thumbnail_failed`, `exif_failed`. These paths are non-fatal
  `logWarning`s today (`submission-processor.ts`) and so are invisible in aggregate: you cannot
  see "30% of thumbnails are failing right now."
- `bus_emit_failed`, `realtime_emit_failed`.
- Redis/Neon call-latency histograms.

Then a per-domain Axiom dashboard: ingestion rate, in-flight vs finalized, error rate by stage,
DLQ depth, Redis/Neon p95. **This is the "manage a live event" console.**

### P2 — End-to-end traces + reliable delivery

**P2.1 — Force-flush telemetry on Lambda.** `LambdaHandler.make` builds a memoized
`ManagedRuntime` and returns immediately; Lambda _freezes_ the process the instant the handler
returns (freeze ≠ termination, so Effect finalizers don't run between invocations).
`BatchSpanProcessor` buffers spans and flushes on its own timer → spans are delivered late on the
next invocation or dropped when the env is reaped — exactly when you need the trace for the
failure that just happened. Fix: `forceFlush()` the tracer/logger providers at the end of each
invocation, or adopt the AWS OTel Lambda layer.

**P2.2 — Propagate trace context across hops.** Inject a W3C `traceparent` into the EventBridge
`Detail` (extend `FinalizedEventSchema`) and reconstruct the parent on the consumer via
`Tracer.externalSpan({ traceId, spanId })` + `Effect.withSpan(..., { parent })`. S3→SQS can't be
injected (S3 owns the message), so lean on the `uploadSessionId`/`domain`+`reference` span
attributes from P0.1 as the join key there. Result: one clickable trace spanning a participant's
full journey.

### P3 — Logger + error-shape hardening

- **`PubSubLoggerService`** — ✅ **REMOVED** (2026-06-14). It fire-and-forgot _every_ log line via
  `Effect.runFork` to a hardcoded `dev:logger:{taskName}` Redis channel (ignored environment, no
  backpressure, silent drops) and was merged into the shared task runtime — so every task paid an
  extra Upstash publish per log line, in prod too, for a channel with **no subscriber anywhere in
  the repo**. Deleted outright rather than gated to dev: there was no consumer in any environment.
  The underlying `PubSubService` (`pubsub-service.ts`) is untouched — only the logger built on it
  was removed.
- **Swallowed realtime-emit failures.** `withEventResult` downgrades emit failures to `logWarning`
  (`realtime-events-service.ts`). If emission breaks, the live UI silently freezes. Pair with the
  `realtime_emit_failed` counter (P1) + an alarm.
- **Aggregatable errors.** Errors are logged via `Cause.pretty` (a string), discarding the tagged
  structure (`PhotoNotFoundError`, `InvalidObjectKeyFormatError`, …). Annotate the error `_tag` as
  a discrete log/span field so failures can be charted by type instead of full-text-searched.

## Suggested sequence

1. **P0** — span correlation attributes + DLQ/throttle alarms. _(done)_
2. **P1** — Effect metrics + Axiom dashboard. _(makes a live event manageable)_
3. **P2** — Lambda force-flush + trace-context propagation. _(makes debugging fast)_
4. **P3** — logger + error-shape hardening.

## Changelog

### 2026-06-14 — P3.1 partial: PubSub logger removed

| Area                                            | Change                                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `packages/pubsub/src/logger.ts`                 | Deleted — `makePubSubLogger` / `PubSubLoggerService` published every log line to an unsubscribed `dev:logger:{taskName}` channel |
| `packages/pubsub/src/index.ts`                  | Dropped `export * from './logger'`                                                                                          |
| `packages/task-runtime/src/layer.ts`            | Removed `PubSubLoggerService` from the shared `makeTaskRuntimeLayer` (the change that covers every live task)               |
| `tasks/voting-sms-notifier/src/index.ts`        | Removed the one remaining direct reference; deprecated-task references (active + commented) cleaned out too                 |

> Confirmed no subscriber to `dev:logger:*` exists anywhere in the repo, so this was deleted rather
> than gated to dev. `PubSubService` (the publish/subscribe primitive) is untouched. Remaining P3
> items — swallowed realtime-emit failures, aggregatable error `_tag`s — are still open.

### 2026-06-14 — P0 shipped

| Area                                            | Change                                                                                                                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/task-runtime/src/lambda.ts`           | Per-record span annotated with `blikka.task` + `messaging.message_id`; in `makeSqsRealtimeTask`, each input's workflow wrapped in a child span carrying `blikka.domain`/`blikka.reference`/`blikka.order_index` |
| `packages/uploads/src/submission-processor.ts`  | `process` span annotates `blikka.domain`/`blikka.reference`/`blikka.order_index` + `blikka.upload_session_id` (once KV is resolved), via `annotateCurrentSpan` inside the body                                  |
| `packages/uploads/src/participant-finalizer.ts` | `finalize` span annotates `blikka.domain`/`blikka.reference`/`blikka.upload_session_id` from input, via `annotateCurrentSpan` inside the body                                                                   |
| `sst.config.ts`                                 | New `ObservabilityAlertsTopic` (SNS) + CloudWatch alarms: DLQ-not-empty (×6), queue-backlog age (×3 finalize-side queues — not the capped upload-processor queue), per-subscriber `Throttles` and `Errors`      |

</content>
</invoke>
