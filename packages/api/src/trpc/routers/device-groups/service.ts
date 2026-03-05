import "server-only"

import { type NewDeviceGroup, Database } from "@blikka/db"
import { Effect, Layer, Option, ServiceMap } from "effect"
import { DeviceGroupApiError } from "./schemas"

export class DeviceGroupsApiService extends ServiceMap.Service<DeviceGroupsApiService>()(
  "@blikka/api/DeviceGroupsApiService",
  {
    make: Effect.gen(function* () {
      const db = yield* Database

      const createDeviceGroup = Effect.fn("DeviceGroupsApiService.createDeviceGroup")(function* ({
        domain,
        data,
      }: {
        domain: string
        data: Omit<NewDeviceGroup, "marathonId">
      }) {
        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain,
        })

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Marathon not found for domain ${domain}`,
            })
          )
        }

        return yield* db.deviceGroupsQueries.createDeviceGroup({
          data: {
            ...data,
            marathonId: marathon.value.id,
            icon: data.icon ?? "camera",
          },
        })
      })

      const updateDeviceGroup = Effect.fn("DeviceGroupsApiService.updateDeviceGroup")(function* ({
        domain,
        id,
        data,
      }: {
        domain: string
        id: number
        data: Partial<NewDeviceGroup>
      }) {
        const deviceGroup = yield* db.deviceGroupsQueries.getDeviceGroupById({
          id,
        })

        if (Option.isNone(deviceGroup)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group not found with id ${id}`,
            })
          )
        }

        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain,
        })

        if (Option.isNone(marathon) || marathon.value.id !== deviceGroup.value.marathonId) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group does not belong to domain ${domain}`,
            })
          )
        }

        return yield* db.deviceGroupsQueries.updateDeviceGroup({
          id,
          data,
        })
      })

      const deleteDeviceGroup = Effect.fn("DeviceGroupsApiService.deleteDeviceGroup")(function* ({
        domain,
        id,
      }: {
        domain: string
        id: number
      }) {
        const deviceGroup = yield* db.deviceGroupsQueries.getDeviceGroupById({
          id,
        })

        if (Option.isNone(deviceGroup)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group not found with id ${id}`,
            })
          )
        }

        const marathon = yield* db.marathonsQueries.getMarathonByDomain({
          domain,
        })

        if (Option.isNone(marathon) || marathon.value.id !== deviceGroup.value.marathonId) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group does not belong to domain ${domain}`,
            })
          )
        }

        return yield* db.deviceGroupsQueries.deleteDeviceGroup({ id })
      })

      return {
        createDeviceGroup,
        updateDeviceGroup,
        deleteDeviceGroup,
      } as const
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(Database.layer)
  )
}
