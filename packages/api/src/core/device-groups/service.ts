import 'server-only'

import { Effect, Layer, Context } from 'effect'
import {
  DbLayer,
  DeviceGroupsRepository,
  MarathonsRepository,
  DbError,
  type DeviceGroup,
} from '@blikka/db'
import type {
  CreateDeviceGroupInput,
  DeleteDeviceGroupInput,
  UpdateDeviceGroupInput,
} from './contracts'
import { ForbiddenError, NotFoundError, failNotFoundIfNone } from '../errors'

export class DeviceGroupsService extends Context.Service<
  DeviceGroupsService,
  {
    /**
     * Creates a device group for the marathon on `domain`, defaulting `icon` to `"camera"`
     * when not provided.
     */
    readonly createDeviceGroup: (
      input: CreateDeviceGroupInput,
    ) => Effect.Effect<DeviceGroup, DbError | NotFoundError, never>

    /**
     * Applies a partial update to a device group scoped to `domain`; fails when the row is missing
     * or is not tied to this marathon.
     */
    readonly updateDeviceGroup: (
      input: UpdateDeviceGroupInput,
    ) => Effect.Effect<DeviceGroup, DbError | NotFoundError | ForbiddenError, never>

    /** Deletes a device group after verifying marathon ownership via `domain`. */
    readonly deleteDeviceGroup: (
      input: DeleteDeviceGroupInput,
    ) => Effect.Effect<DeviceGroup, DbError | NotFoundError | ForbiddenError, never>
  }
>()('@blikka/api/DeviceGroupsService') {}

const makeDeviceGroupsService = Effect.gen(function* () {
  const marathonsRepository = yield* MarathonsRepository
  const deviceGroupsRepository = yield* DeviceGroupsRepository

  const ensureDeviceGroupBelongsToDomain = Effect.fn(
    'DeviceGroupsService.ensureDeviceGroupBelongsToDomain',
  )(function* ({ id, domain }: { id: number; domain: string }) {
    const deviceGroup = yield* deviceGroupsRepository
      .getDeviceGroupById({ id })
      .pipe(failNotFoundIfNone('DeviceGroup', { id }))

    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

    if (marathon.id !== deviceGroup.marathonId) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: `Device group ${id} does not belong to domain ${domain}`,
        }),
      )
    }

    return deviceGroup
  })

  const createDeviceGroup: DeviceGroupsService['Service']['createDeviceGroup'] = Effect.fn(
    'DeviceGroupsService.createDeviceGroup',
  )(function* ({ domain, data }) {
    const marathon = yield* marathonsRepository
      .getMarathonByDomain({ domain })
      .pipe(failNotFoundIfNone('Marathon', { domain }))

    return yield* deviceGroupsRepository.createDeviceGroup({
      data: {
        ...data,
        marathonId: marathon.id,
        icon: data.icon ?? 'camera',
      },
    })
  })

  const updateDeviceGroup: DeviceGroupsService['Service']['updateDeviceGroup'] = Effect.fn(
    'DeviceGroupsService.updateDeviceGroup',
  )(function* ({ domain, id, data }) {
    yield* ensureDeviceGroupBelongsToDomain({ id, domain })
    return yield* deviceGroupsRepository.updateDeviceGroup({
      id,
      data,
    })
  })

  const deleteDeviceGroup: DeviceGroupsService['Service']['deleteDeviceGroup'] = Effect.fn(
    'DeviceGroupsService.deleteDeviceGroup',
  )(function* ({ domain, id }) {
    yield* ensureDeviceGroupBelongsToDomain({ id, domain })
    return yield* deviceGroupsRepository.deleteDeviceGroup({ id })
  })

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

export const DeviceGroupsServiceLayer = DeviceGroupsServiceLayerNoDeps.pipe(Layer.provide(DbLayer))
