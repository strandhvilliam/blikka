import "server-only"

import { Effect } from "effect"
import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import {
  CreateDeviceGroupInputSchema,
  UpdateDeviceGroupInputSchema,
  DeleteDeviceGroupInputSchema,
} from "./schemas"
import { DeviceGroupsApiService } from "./service"

export const deviceGroupsRouter = createTRPCRouter({
  create: domainProcedure.input(CreateDeviceGroupInputSchema).mutation(
    trpcEffect(
      Effect.fn("DeviceGroupsRouter.create")(function* ({ input }) {
        return yield* DeviceGroupsApiService.use((s) => s.createDeviceGroup(input))
      })
    )
  ),

  update: domainProcedure.input(UpdateDeviceGroupInputSchema).mutation(
    trpcEffect(
      Effect.fn("DeviceGroupsRouter.update")(function* ({ input }) {
        return yield* DeviceGroupsApiService.use((s) => s.updateDeviceGroup(input))
      })
    )
  ),

  delete: domainProcedure.input(DeleteDeviceGroupInputSchema).mutation(
    trpcEffect(
      Effect.fn("DeviceGroupsRouter.delete")(function* ({ input }) {
        return yield* DeviceGroupsApiService.use((s) => s.deleteDeviceGroup(input))
      })
    )
  ),
})
