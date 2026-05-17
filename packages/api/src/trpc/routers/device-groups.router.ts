import "server-only";

import { Effect, Schema } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../root";
import { trpcEffect } from "../utils";
import {
  CreateDeviceGroupInputSchema,
  UpdateDeviceGroupInputSchema,
  DeleteDeviceGroupInputSchema,
} from "../../core/device-groups/contracts";
import { DeviceGroupsService } from "../../core/device-groups/service";

export const deviceGroupsRouter = createTRPCRouter({
  create: domainProcedure
    .input(Schema.toStandardSchemaV1(CreateDeviceGroupInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("DeviceGroupsRouter.create")(function* ({ input }) {
          return yield* DeviceGroupsService.use((s) =>
            s.createDeviceGroup(input),
          );
        }),
      ),
    ),

  update: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateDeviceGroupInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("DeviceGroupsRouter.update")(function* ({ input }) {
          return yield* DeviceGroupsService.use((s) =>
            s.updateDeviceGroup(input),
          );
        }),
      ),
    ),

  delete: domainProcedure
    .input(Schema.toStandardSchemaV1(DeleteDeviceGroupInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("DeviceGroupsRouter.delete")(function* ({ input }) {
          return yield* DeviceGroupsService.use((s) =>
            s.deleteDeviceGroup(input),
          );
        }),
      ),
    ),
});
