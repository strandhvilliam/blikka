import "server-only";

import { Effect } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { trpcEffect } from "../../utils";
import {
  CreateDeviceGroupInputSchema,
  UpdateDeviceGroupInputSchema,
  DeleteDeviceGroupInputSchema,
} from "./schemas";
import { DeviceGroupsApiService } from "./service";

export const deviceGroupsRouter = createTRPCRouter({
  create: domainProcedure
    .input(CreateDeviceGroupInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("DeviceGroupsRouter.create")(function* ({ input }) {
          return yield* DeviceGroupsApiService.use((s) =>
            s.createDeviceGroup(input),
          );
        }),
      ),
    ),

  update: domainProcedure
    .input(UpdateDeviceGroupInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("DeviceGroupsRouter.update")(function* ({ input }) {
          return yield* DeviceGroupsApiService.use((s) =>
            s.updateDeviceGroup(input),
          );
        }),
      ),
    ),

  delete: domainProcedure
    .input(DeleteDeviceGroupInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("DeviceGroupsRouter.delete")(function* ({ input }) {
          return yield* DeviceGroupsApiService.use((s) =>
            s.deleteDeviceGroup(input),
          );
        }),
      ),
    ),
});
