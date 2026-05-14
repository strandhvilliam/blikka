import { Config, Effect, Schema } from "effect"
import { Resource as SSTResource } from "sst"
import { ZipWorker, ZipWorkerLayer } from "@blikka/uploads"
import {
  getEnvironmentFromStage,
  makeContainerRealtimeTask,
  makeContainerTaskLayer,
  runContainerTask,
} from "@blikka/task-runtime"

export class InvalidArgumentsError extends Schema.TaggedErrorClass<InvalidArgumentsError>()(
  "InvalidArgumentsError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

const TASK_NAME = "zip-worker"
const REALTIME_EVENT = "zip-generated"

const parseInput = Effect.fn("ZipWorker.parseInput")(
  function* () {
    const domain = yield* Config.string("ARG_DOMAIN")
    const reference = yield* Config.string("ARG_REFERENCE")
    return { domain, reference }
  },
  Effect.mapError(
    (error) => new InvalidArgumentsError({ message: "Failed to parse arguments", cause: error }),
  ),
)

const runnable = makeContainerRealtimeTask({
  taskName: TASK_NAME,
  spanName: "ZipWorker.task",
  eventKey: REALTIME_EVENT,
  parseInput: parseInput(),
  run: (input) =>
    Effect.gen(function* () {
      const worker = yield* ZipWorker
      yield* Effect.logInfo("Running zip task")

      yield* worker.runZipTask(input)

      yield* Effect.logInfo("Zip task completed")
    }),
})

const layer = makeContainerTaskLayer({
  taskName: TASK_NAME,
  environment: getEnvironmentFromStage(SSTResource.App.stage),
  workflowLayer: ZipWorkerLayer,
})

runContainerTask(runnable, layer)
