import { Effect, Layer, Option, Context } from 'effect'
import { DrizzleClient } from '../drizzle-client'
import { deviceGroups, marathons } from '../schema'
import { eq } from 'drizzle-orm'
import type { DeviceGroup, NewDeviceGroup } from '../types'
import { DbError } from '../utils'

export class DeviceGroupsRepository extends Context.Service<
  DeviceGroupsRepository,
  {
    /** Device group row by primary key, or none if missing. */
    readonly getDeviceGroupById: (params: {
      id: number
    }) => Effect.Effect<Option.Option<DeviceGroup>, DbError>
    /** Device groups belonging to the marathon identified by domain. */
    readonly getDeviceGroupsByDomain: (params: {
      domain: string
    }) => Effect.Effect<DeviceGroup[], DbError>
    /** Insert a new device group row. */
    readonly createDeviceGroup: (params: {
      data: NewDeviceGroup
    }) => Effect.Effect<DeviceGroup, DbError>
    /** Patch fields on a device group identified by id. */
    readonly updateDeviceGroup: (params: {
      id: number
      data: Partial<NewDeviceGroup>
    }) => Effect.Effect<DeviceGroup, DbError>
    /** Delete a device group by id. */
    readonly deleteDeviceGroup: (params: { id: number }) => Effect.Effect<DeviceGroup, DbError>
  }
>()('@blikka.app/db/device-group-queries') {}

const makeDeviceGroupsRepository = Effect.gen(function* () {
  const { use } = yield* DrizzleClient
  const getDeviceGroupById: DeviceGroupsRepository['Service']['getDeviceGroupById'] = Effect.fn(
    'DeviceGroupsRepository.getDeviceGroupById',
  )(function* ({ id }) {
    const result = yield* use((db) =>
      db.query.deviceGroups.findFirst({
        where: (table, operators) => operators.eq(table.id, id),
      }),
    )
    return Option.fromNullishOr(result)
  })
  const getDeviceGroupsByDomain: DeviceGroupsRepository['Service']['getDeviceGroupsByDomain'] =
    Effect.fn('DeviceGroupsRepository.getDeviceGroupsByDomain')(function* ({ domain }) {
      const result = yield* use((db) =>
        db
          .select()
          .from(deviceGroups)
          .innerJoin(marathons, eq(deviceGroups.marathonId, marathons.id))
          .where(eq(marathons.domain, domain)),
      )
      return result.map((row) => row.device_groups)
    })
  const createDeviceGroup: DeviceGroupsRepository['Service']['createDeviceGroup'] = Effect.fn(
    'DeviceGroupsRepository.createDeviceGroup',
  )(function* ({ data }) {
    const [result] = yield* use((db) => db.insert(deviceGroups).values(data).returning())
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to create device group',
        }),
      )
    }
    return result
  })
  const updateDeviceGroup: DeviceGroupsRepository['Service']['updateDeviceGroup'] = Effect.fn(
    'DeviceGroupsRepository.updateDeviceGroup',
  )(function* ({ id, data }) {
    const [result] = yield* use((db) =>
      db.update(deviceGroups).set(data).where(eq(deviceGroups.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to update device group',
        }),
      )
    }
    return result
  })
  const deleteDeviceGroup: DeviceGroupsRepository['Service']['deleteDeviceGroup'] = Effect.fn(
    'DeviceGroupsRepository.deleteDeviceGroup',
  )(function* ({ id }) {
    const [result] = yield* use((db) =>
      db.delete(deviceGroups).where(eq(deviceGroups.id, id)).returning(),
    )
    if (!result) {
      return yield* Effect.fail(
        new DbError({
          message: 'Failed to delete device group',
        }),
      )
    }
    return result
  })
  return DeviceGroupsRepository.of({
    getDeviceGroupById,
    getDeviceGroupsByDomain,
    createDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
  })
})

export const DeviceGroupsRepositoryLayerNoDeps = Layer.effect(
  DeviceGroupsRepository,
  makeDeviceGroupsRepository,
)

export const DeviceGroupsRepositoryLayer = DeviceGroupsRepositoryLayerNoDeps.pipe(
  Layer.provide(DrizzleClient.layer),
)
