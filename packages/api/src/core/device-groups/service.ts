import "server-only"

import { Effect, Layer, Option, Context } from "effect"
import {
  DbLayer,
  DeviceGroupsRepository,
  MarathonsRepository,
  DbError,
  type DeviceGroup,
} from "@blikka/db"
import type {
  CreateDeviceGroupInput,
  DeleteDeviceGroupInput,
  UpdateDeviceGroupInput,
} from "./contracts"
import { DeviceGroupApiError } from "./errors"

export class DeviceGroupsService extends Context.Service<
  DeviceGroupsService,
  {
    /**
     * Creates a device group for the marathon on `domain`, defaulting `icon` to `"camera"`
     * when not provided.
     */
    readonly createDeviceGroup: (
      input: CreateDeviceGroupInput,
    ) => Effect.Effect<DeviceGroup, DbError | DeviceGroupApiError, never>

    /**
     * Applies a partial update to a device group scoped to `domain`; fails when the row is missing
     * or is not tied to this marathon.
     */
    readonly updateDeviceGroup: (
      input: UpdateDeviceGroupInput,
    ) => Effect.Effect<DeviceGroup, DbError | DeviceGroupApiError, never>

    /** Deletes a device group after verifying marathon ownership via `domain`. */
    readonly deleteDeviceGroup: (
      input: DeleteDeviceGroupInput,
    ) => Effect.Effect<DeviceGroup, DbError | DeviceGroupApiError, never>
  }
>()("@blikka/api/DeviceGroupsService") {}

const makeDeviceGroupsService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const deviceGroupsRepository = yield* DeviceGroupsRepository

  const createDeviceGroup: DeviceGroupsService["Service"]["createDeviceGroup"] =
    Effect.fn("DeviceGroupsService.createDeviceGroup")(
      function* ({ domain, data }) {
        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        })

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Marathon not found for domain ${domain}`,
            }),
          )
        }

        return yield* deviceGroupsRepository.createDeviceGroup({
          data: {
            ...data,
            marathonId: marathon.value.id,
            icon: data.icon ?? "camera",
          },
        })
      },
    )

  const updateDeviceGroup: DeviceGroupsService["Service"]["updateDeviceGroup"] =
    Effect.fn("DeviceGroupsService.updateDeviceGroup")(
      function* ({ domain, id, data }) {
        const deviceGroup = yield* deviceGroupsRepository.getDeviceGroupById({
          id,
        })

        if (Option.isNone(deviceGroup)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group not found with id ${id}`,
            }),
          )
        }

        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        })

        if (
          Option.isNone(marathon) ||
          marathon.value.id !== deviceGroup.value.marathonId
        ) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group does not belong to domain ${domain}`,
            }),
          )
        }

        return yield* deviceGroupsRepository.updateDeviceGroup({
          id,
          data,
        })
      },
    )

  const deleteDeviceGroup: DeviceGroupsService["Service"]["deleteDeviceGroup"] =
    Effect.fn("DeviceGroupsService.deleteDeviceGroup")(
      function* ({ domain, id }) {
        const deviceGroup = yield* deviceGroupsRepository.getDeviceGroupById({
          id,
        })

        if (Option.isNone(deviceGroup)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group not found with id ${id}`,
            }),
          )
        }

        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        })

        if (
          Option.isNone(marathon) ||
          marathon.value.id !== deviceGroup.value.marathonId
        ) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group does not belong to domain ${domain}`,
            }),
          )
        }

        return yield* deviceGroupsRepository.deleteDeviceGroup({ id })
      },
    )

  return DeviceGroupsService.of({
    createDeviceGroup,
    updateDeviceGroup,
    deleteDeviceGroup,
  })
})

export const DeviceGroupsServiceLayerNoDeps = Layer.effect(
  DeviceGroupsService,
  makeDeviceGroupsService,
)

export const DeviceGroupsServiceLayer = DeviceGroupsServiceLayerNoDeps.pipe(
  Layer.provide(DbLayer),
)
