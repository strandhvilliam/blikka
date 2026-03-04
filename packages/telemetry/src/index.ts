
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs"
import { NodeSdk } from "@effect/opentelemetry"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base"
import {
  Effect,
  Layer,
  Logger,
} from "effect"

export const addTraceDataToLoggers = Layer.effect(
  Logger.CurrentLoggers,
  Effect.gen(function* () {
    const currentLoggers = yield* Effect.service(Logger.CurrentLoggers)

    return new Set(Array.from(currentLoggers).map(logger =>
      Logger.make((options) => {
        const span = options.fiber.currentSpan
        let output = logger.log(options)

        if (span !== undefined && span._tag !== "ExternalSpan") {
          if (typeof output === "string") {
            output = `[traceId=${span.traceId} spanId=${span.spanId}] ${output}`
          } else if (typeof output === "object" && output !== null) {
            output = {
              ...output,
              traceId: span.traceId,
              spanId: span.spanId
            }
          }
        }

        return output
      })
    ))
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