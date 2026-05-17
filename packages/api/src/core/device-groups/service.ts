import "server-only";

import {
  DbLayer,
  DeviceGroupsRepository,
  MarathonsRepository,
  type NewDeviceGroup,
} from "@blikka/db";
import { Effect, Layer, Option, Context } from "effect";
import { DeviceGroupApiError } from "./errors";

export class DeviceGroupsService extends Context.Service<DeviceGroupsService>()(
  "@blikka/api/DeviceGroupsService",
  {
    make: Effect.gen(function* () {
      const marathonsRepository = yield* MarathonsRepository;
      const deviceGroupsRepository = yield* DeviceGroupsRepository;

      const createDeviceGroup = Effect.fn(
        "DeviceGroupsService.createDeviceGroup",
      )(function* ({
        domain,
        data,
      }: {
        domain: string;
        data: Omit<NewDeviceGroup, "marathonId">;
      }) {
        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });

        if (Option.isNone(marathon)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Marathon not found for domain ${domain}`,
            }),
          );
        }

        return yield* deviceGroupsRepository.createDeviceGroup({
          data: {
            ...data,
            marathonId: marathon.value.id,
            icon: data.icon ?? "camera",
          },
        });
      });

      const updateDeviceGroup = Effect.fn(
        "DeviceGroupsService.updateDeviceGroup",
      )(function* ({
        domain,
        id,
        data,
      }: {
        domain: string;
        id: number;
        data: Partial<NewDeviceGroup>;
      }) {
        const deviceGroup = yield* deviceGroupsRepository.getDeviceGroupById({
          id,
        });

        if (Option.isNone(deviceGroup)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group not found with id ${id}`,
            }),
          );
        }

        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });

        if (
          Option.isNone(marathon) ||
          marathon.value.id !== deviceGroup.value.marathonId
        ) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group does not belong to domain ${domain}`,
            }),
          );
        }

        return yield* deviceGroupsRepository.updateDeviceGroup({
          id,
          data,
        });
      });

      const deleteDeviceGroup = Effect.fn(
        "DeviceGroupsService.deleteDeviceGroup",
      )(function* ({ domain, id }: { domain: string; id: number }) {
        const deviceGroup = yield* deviceGroupsRepository.getDeviceGroupById({
          id,
        });

        if (Option.isNone(deviceGroup)) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group not found with id ${id}`,
            }),
          );
        }

        const marathon = yield* marathonsRepository.getMarathonByDomain({
          domain,
        });

        if (
          Option.isNone(marathon) ||
          marathon.value.id !== deviceGroup.value.marathonId
        ) {
          return yield* Effect.fail(
            new DeviceGroupApiError({
              message: `Device group does not belong to domain ${domain}`,
            }),
          );
        }

        return yield* deviceGroupsRepository.deleteDeviceGroup({ id });
      });

      return {
        createDeviceGroup,
        updateDeviceGroup,
        deleteDeviceGroup,
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(DbLayer),
  );
}
