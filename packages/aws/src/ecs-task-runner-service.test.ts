import { assert, describe, it } from '@effect/vitest'
import type { ECSClient } from '@aws-sdk/client-ecs'
import { Effect, Layer } from 'effect'

import { ECSEffectClient } from './clients/ecs-effect-client'
import { EcsTaskRunnerService, EcsTaskRunnerServiceLayerNoDeps } from './ecs-task-runner-service'

describe('EcsTaskRunnerService', () => {
  it.effect('runs a Fargate task with container environment overrides', () =>
    Effect.gen(function* () {
      const sentCommands: unknown[] = []

      const ecsEffectClient = ECSEffectClient.of({
        use: (fn) =>
          Effect.sync(() =>
            fn({
              send: (command: unknown) => {
                sentCommands.push(command)
                return Promise.resolve({ tasks: [] })
              },
            } as ECSClient),
          ),
      })

      const layer = EcsTaskRunnerServiceLayerNoDeps.pipe(
        Layer.provide(Layer.succeed(ECSEffectClient)(ecsEffectClient)),
      )

      yield* Effect.gen(function* () {
        const runner = yield* EcsTaskRunnerService
        return yield* runner.runFargateTask({
          cluster: 'blikka-cluster',
          taskDefinition: 'zip-downloader',
          subnets: ['subnet-a', 'subnet-b'],
          containerName: 'ZipDownloaderTask',
          environment: { JOB_ID: 'job-123' },
        })
      }).pipe(Effect.provide(layer))

      assert.equal(sentCommands.length, 1)
      const command = sentCommands[0] as {
        input: {
          cluster: string
          taskDefinition: string
          launchType: string
          networkConfiguration: {
            awsvpcConfiguration: { subnets: string[]; assignPublicIp: string }
          }
          overrides: {
            containerOverrides: Array<{
              name: string
              environment: Array<{ name: string; value: string }>
            }>
          }
        }
      }

      assert.equal(command.input.cluster, 'blikka-cluster')
      assert.equal(command.input.taskDefinition, 'zip-downloader')
      assert.equal(command.input.launchType, 'FARGATE')
      assert.deepEqual(command.input.networkConfiguration.awsvpcConfiguration.subnets, [
        'subnet-a',
        'subnet-b',
      ])
      assert.equal(
        command.input.networkConfiguration.awsvpcConfiguration.assignPublicIp,
        'ENABLED',
      )
      assert.deepEqual(command.input.overrides.containerOverrides, [
        {
          name: 'ZipDownloaderTask',
          environment: [{ name: 'JOB_ID', value: 'job-123' }],
        },
      ])
    }),
  )
})
