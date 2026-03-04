import { Effect, Layer, Option, ServiceMap } from "effect"
import { DrizzleClient } from "../drizzle-client"
import { deviceGroups, marathons } from "../schema"
import { eq } from "drizzle-orm"
import type { NewDeviceGroup } from "../types"
import { DbError } from "../utils"

export class DeviceGroupsQueries extends ServiceMap.Service<DeviceGroupsQueries>()(
  "@blikka.app/db/device-group-queries",
  {
    make: Effect.gen(function* () {
      const db = yield* DrizzleClient

      const getDeviceGroupById = Effect.fn(
        "DeviceGroupsQueries.getDeviceGroupById",
      )(function* ({ id }: { id: number }) {
        const result = yield* db.query.deviceGroups.findFirst({
          where: { id },
        })
        return Option.fromNullishOr(result)
      })

      const getDeviceGroupsByDomain = Effect.fn(
        "DeviceGroupsQueries.getDeviceGroupsByDomain",
      )(function* ({ domain }: { domain: string }) {
        const result = yield* db
          .select()
          .from(deviceGroups)
          .innerJoin(marathons, eq(deviceGroups.marathonId, marathons.id))
          .where(eq(marathons.domain, domain))

        return result.map((row) => row.device_groups)
      })

      const createDeviceGroup = Effect.fn(
        "DeviceGroupsQueries.createDeviceGroup",
      )(function* ({ data }: { data: NewDeviceGroup }) {
        const [result] = yield* db
          .insert(deviceGroups)
          .values(data)
          .returning()

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to create device group",
            }),
          )
        }

        return result
      })

      const updateDeviceGroup = Effect.fn(
        "DeviceGroupsQueries.updateDeviceGroup",
      )(function* ({
        id,
        data,
      }: {
        id: number
        data: Partial<NewDeviceGroup>
      }) {
        const [result] = yield* db
          .update(deviceGroups)
          .set(data)
          .where(eq(deviceGroups.id, id))
          .returning()

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to update device group",
            }),
          )
        }
        return result
      })

      const deleteDeviceGroup = Effect.fn(
        "DeviceGroupsQueries.deleteDeviceGroup",
      )(function* ({ id }: { id: number }) {
        const [result] = yield* db
          .delete(deviceGroups)
          .where(eq(deviceGroups.id, id))
          .returning()

        if (!result) {
          return yield* Effect.fail(
            new DbError({
              message: "Failed to delete device group",
            }),
          )
        }
        return result
      })

      return {
        getDeviceGroupById,
        getDeviceGroupsByDomain,
        createDeviceGroup,
        updateDeviceGroup,
        deleteDeviceGroup,
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DrizzleClient.layer)
  )
}
