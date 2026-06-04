import {
  RunTaskCommand,
  type RunTaskCommandOutput,
} from '@aws-sdk/client-ecs'
import { Effect, Layer, Schema, Context } from 'effect'

import { ECSEffectClient, ECSEffectClientLayer } from './clients/ecs-effect-client'

export class EcsTaskRunnerError extends Schema.TaggedErrorClass<EcsTaskRunnerError>()(
  'EcsTaskRunnerError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) { }

export interface RunFargateTaskParams {
  readonly cluster: string
  readonly taskDefinition: string
  readonly subnets: readonly string[]
  readonly containerName: string
  readonly environment: Readonly<Record<string, string>>
  readonly assignPublicIp?: 'ENABLED' | 'DISABLED'
}

export class EcsTaskRunnerService extends Context.Service<
  EcsTaskRunnerService,
  {
    readonly runFargateTask: (
      params: RunFargateTaskParams,
    ) => Effect.Effect<RunTaskCommandOutput, EcsTaskRunnerError, never>
  }
>()('@blikka/aws/EcsTaskRunnerService') { }

const makeEcsTaskRunnerService = Effect.gen(function*() {
  const ecsClient = yield* ECSEffectClient

  const runFargateTask: EcsTaskRunnerService['Service']['runFargateTask'] = Effect.fn(
    'EcsTaskRunnerService.runFargateTask',
  )(function*(params) {
    const assignPublicIp = params.assignPublicIp ?? 'ENABLED'
    const containerEnvironment = Object.entries(params.environment).map(([name, value]) => ({
      name,
      value,
    }))

    return yield* ecsClient.use((client) =>
      client.send(
        new RunTaskCommand({
          cluster: params.cluster,
          taskDefinition: params.taskDefinition,
          launchType: 'FARGATE',
          networkConfiguration: {
            awsvpcConfiguration: {
              subnets: [...params.subnets],
              assignPublicIp,
            },
          },
          overrides: {
            containerOverrides: [
              {
                name: params.containerName,
                environment: containerEnvironment,
              },
            ],
          },
        }),
      ),
    )
  },
    Effect.mapError(
      (error) =>
        new EcsTaskRunnerError({
          message: error.message ?? 'Failed to run ECS Fargate task',
          cause: error,
        }),
    ),
  )

  return EcsTaskRunnerService.of({
    runFargateTask,
  })
})

export const EcsTaskRunnerServiceLayerNoDeps = Layer.effect(
  EcsTaskRunnerService,
  makeEcsTaskRunnerService,
)

export const EcsTaskRunnerServiceLayer = EcsTaskRunnerServiceLayerNoDeps.pipe(
  Layer.provide(ECSEffectClientLayer),
)
