import "server-only"

import { Effect } from "effect"
import { authProcedure, createTRPCRouter } from "../../root"
import { assertAllowedToAccessDomain, trpcEffect } from "../../utils"
import {
  GetStaffMembersByDomainInputSchema,
  GetStaffMemberByIdInputSchema,
  CreateStaffMemberInputSchema,
  DeleteUserMarathonRelationInputSchema,
} from "./schemas"
import { UsersApiService } from "./service"

export const usersRouter = createTRPCRouter({
  getStaffMembersByDomain: authProcedure.input(GetStaffMembersByDomainInputSchema).query(
    trpcEffect(
      Effect.fn("UsersRouter.getStaffMembersByDomain")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* UsersApiService.getStaffMembersByDomain({ domain: input.domain })
      })
    )
  ),

  getStaffMemberById: authProcedure.input(GetStaffMemberByIdInputSchema).query(
    trpcEffect(
      Effect.fn("UsersRouter.getStaffMemberById")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* UsersApiService.getStaffMemberById({
          staffId: input.staffId,
          domain: input.domain,
        })
      })
    )
  ),

  createStaffMember: authProcedure.input(CreateStaffMemberInputSchema).mutation(
    trpcEffect(
      Effect.fn("UsersRouter.createStaffMember")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* UsersApiService.createStaffMember({
          domain: input.domain,
          data: input.data,
        })
      })
    )
  ),

  deleteUserMarathonRelation: authProcedure.input(DeleteUserMarathonRelationInputSchema).mutation(
    trpcEffect(
      Effect.fn("UsersRouter.deleteUserMarathonRelation")(function* ({ input, ctx }) {
        yield* assertAllowedToAccessDomain({ domain: input.domain, ctx })

        return yield* UsersApiService.deleteUserMarathonRelation({
          domain: input.domain,
          userId: input.userId,
        })
      })
    )
  ),
})
