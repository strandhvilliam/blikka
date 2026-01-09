import "server-only"

import { Effect } from "effect"
import { createTRPCRouter, domainProcedure } from "../../root"
import { trpcEffect } from "../../utils"
import {
  GetStaffMembersByDomainInputSchema,
  GetStaffMemberByIdInputSchema,
  CreateStaffMemberInputSchema,
  DeleteUserMarathonRelationInputSchema,
  GetVerificationsByStaffIdInputSchema,
  UpdateStaffMemberInputSchema,
} from "./schemas"
import { UsersApiService } from "./service"

export const usersRouter = createTRPCRouter({
  getStaffMembersByDomain: domainProcedure.input(GetStaffMembersByDomainInputSchema).query(
    trpcEffect(
      Effect.fn("UsersRouter.getStaffMembersByDomain")(function* ({ input }) {
        return yield* UsersApiService.getStaffMembersByDomain({ domain: input.domain })
      })
    )
  ),

  getStaffMemberById: domainProcedure.input(GetStaffMemberByIdInputSchema).query(
    trpcEffect(
      Effect.fn("UsersRouter.getStaffMemberById")(function* ({ input }) {
        return yield* UsersApiService.getStaffMemberById({
          staffId: input.staffId,
          domain: input.domain,
        })
      })
    )
  ),

  createStaffMember: domainProcedure.input(CreateStaffMemberInputSchema).mutation(
    trpcEffect(
      Effect.fn("UsersRouter.createStaffMember")(function* ({ input }) {
        return yield* UsersApiService.createStaffMember({
          domain: input.domain,
          data: input.data,
        })
      })
    )
  ),

  deleteUserMarathonRelation: domainProcedure.input(DeleteUserMarathonRelationInputSchema).mutation(
    trpcEffect(
      Effect.fn("UsersRouter.deleteUserMarathonRelation")(function* ({ input }) {
        return yield* UsersApiService.deleteUserMarathonRelation({
          domain: input.domain,
          userId: input.userId,
        })
      })
    )
  ),

  getVerificationsByStaffId: domainProcedure.input(GetVerificationsByStaffIdInputSchema).query(
    trpcEffect(
      Effect.fn("UsersRouter.getVerificationsByStaffId")(function* ({ input }) {
        return yield* UsersApiService.getVerificationsByStaffId({
          staffId: input.staffId,
          domain: input.domain,
          cursor: input.cursor ?? undefined,
          limit: input.limit ?? undefined,
        })
      })
    )
  ),

  updateStaffMember: domainProcedure.input(UpdateStaffMemberInputSchema).mutation(
    trpcEffect(
      Effect.fn("UsersRouter.updateStaffMember")(function* ({ input }) {
        return yield* UsersApiService.updateStaffMember({
          staffId: input.staffId,
          domain: input.domain,
          data: input.data,
        })
      })
    )
  ),
})
