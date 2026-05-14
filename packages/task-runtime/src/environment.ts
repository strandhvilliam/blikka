import { Effect, Context } from "effect";
import { Resource as SSTResource } from "sst";

export type TaskEnvironmentName = "prod" | "dev" | "staging";

export const getEnvironmentFromStage = (stage: string): TaskEnvironmentName => {
  if (stage === "production") return "prod";
  if (stage === "dev" || stage === "development") return "dev";
  return "staging";
};

export class TaskEnvironment extends Context.Service<TaskEnvironment>()(
  "@blikka/task-runtime/TaskEnvironment",
  {
    make: Effect.sync(() => ({
      stage: SSTResource.App.stage,
      environment: getEnvironmentFromStage(SSTResource.App.stage),
    })),
  },
) {}
