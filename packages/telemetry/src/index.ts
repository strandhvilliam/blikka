import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { BatchLogRecordProcessor, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs"
import { NodeSdk } from "@effect/opentelemetry"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchSpanProcessor, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base"
import {
  FiberRef,
  HashSet,
  Effect,
  Layer,
  Option,
  HashMap,
  Logger,
  Context,
  Tracer,
  FiberRefs,
} from "effect"

export const addTraceDataToLoggers = Layer.scopedDiscard(
  Effect.gen(function* () {
    const currentLoggers = yield* FiberRef.get(FiberRef.currentLoggers)
    const newLoggers = HashSet.map(
      currentLoggers,
      Logger.mapInputOptions((options) => {
        const span = Context.getOption(
          FiberRefs.getOrDefault(options.context, FiberRef.currentContext),
          Tracer.ParentSpan
        )
        if (Option.isSome(span)) {
          const annotations = options.annotations.pipe(
            HashMap.set("traceId", span.value.traceId as unknown),
            HashMap.set("spanId", span.value.spanId as unknown)
          )
          return {
            ...options,
            annotations,
          }
        }
        return options
      })
    )
    yield* Effect.locallyScoped(FiberRef.currentLoggers, newLoggers)
  })
)

export const TelemetryLayer = (serviceName: string) =>
  addTraceDataToLoggers.pipe(
    Layer.provideMerge(
      NodeSdk.layer(() => ({
        resource: { serviceName },
        spanProcessor: new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: "https://api.axiom.co/v1/traces",
            headers: {
              Authorization: `Bearer ${process.env.AXIOM_TOKEN}`,
              "X-Axiom-Dataset": "blikka",
            },
            // headers: {
            //   "x-honeycomb-team": "XOqor5R9eH4HRwJulmuAAC",
            //   "x-honeycomb-dataset": "blikka",
            // },
          })
        ),
        logRecordProcessor: new SimpleLogRecordProcessor(
          new OTLPLogExporter({
            url: "https://api.axiom.co/v1/logs",
            headers: {
              Authorization: `Bearer ${process.env.AXIOM_TOKEN}`,
              "X-Axiom-Dataset": "blikka",
            },
          })
        ),
      }))
    )
  )

// export const TelemetryLayer = (serviceName: string) =>
//   NodeSdk.layer(() => ({
//     resource: { serviceName },
//     spanProcessor: new BatchSpanProcessor(new OTLPTraceExporter()),
//     logRecordProcessor: new SimpleLogRecordProcessor(new OTLPLogExporter()),
//   }))
