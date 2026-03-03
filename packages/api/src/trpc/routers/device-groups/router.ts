import "server-only"

import { Effect, Option } from "effect"
import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import { Database } from "@blikka/db"
import {
  CreateDeviceGroupInputSchema,
  UpdateDeviceGroupInputSchema,
  DeleteDeviceGroupInputSchema,
  DeviceGroupApiError,
} from "./schemas"

export const deviceGroupsRouter = createTRPCRouter({
  create: domainProcedure.input(CreateDeviceGroupInputSchema).mutation(
    trpcEffect(
      Effect.fn("DeviceGroupsRouter.create")(function* ({ input }) {
        const db = yield* Database
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain: input.domain,
        })

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Marathon not found for domain ${input.domain}`,
            })
          )
        }

        return yield* db.deviceGroupsQueries.createDeviceGroup({
          data: {
            ...input.data,
            marathonId: marathon.value.id,
            icon: input.data.icon ?? "camera",
          },
        })
      })
    )
  ),

  update: domainProcedure.input(UpdateDeviceGroupInputSchema).mutation(
    trpcEffect(
      Effect.fn("DeviceGroupsRouter.update")(function* ({ input }) {
        const db = yield* Database
        const deviceGroup = yield* db.deviceGroupsQueries.getDeviceGroupById({
          id: input.id,
        })

        if (Option.isNone(deviceGroup)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group not found with id ${input.id}`,
            })
          )
        }

        // Verify device group belongs to the domain
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain: input.domain,
        })

        if (Option.isNone(marathon) || marathon.value.id !== deviceGroup.value.marathonId) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group does not belong to domain ${input.domain}`,
            })
          )
        }

        return yield* db.deviceGroupsQueries.updateDeviceGroup({
          id: input.id,
          data: input.data,
        })
      })
    )
  ),

  delete: domainProcedure.input(DeleteDeviceGroupInputSchema).mutation(
    trpcEffect(
      Effect.fn("DeviceGroupsRouter.delete")(function* ({ input }) {
        const db = yield* Database
        const deviceGroup = yield* db.deviceGroupsQueries.getDeviceGroupById({
          id: input.id,
        })

        if (Option.isNone(deviceGroup)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group not found with id ${input.id}`,
            })
          )
        }

        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain: input.domain,
        })

        if (Option.isNone(marathon) || marathon.value.id !== deviceGroup.value.marathonId) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group does not belong to domain ${input.domain}`,
            })
          )
        }

        return yield* db.deviceGroupsQueries.deleteDeviceGroup({ id: input.id })
      })
    )
  ),
})
