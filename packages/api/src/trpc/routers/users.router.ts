
import { Effect, Schema } from 'effect'
import { createTRPCRouter, domainProcedure, requireMatchingInputDomainMiddleware } from '../root'
import { trpcEffect } from '../utils'
import {
  GetStaffMembersByDomainInputSchema,
  GetStaffMemberByIdInputSchema,
  CreateStaffMemberInputSchema,
  DeleteUserMarathonRelationInputSchema,
  GetVerificationsByStaffIdInputSchema,
  UpdateStaffMemberInputSchema,
} from '../../core/users/contracts'
import { UsersService } from '../../core/users/service'

export const usersRouter = createTRPCRouter({
  getStaffMembersByDomain: domainProcedure
    .input(Schema.toStandardSchemaV1(GetStaffMembersByDomainInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('UsersRouter.getStaffMembersByDomain')(function* ({ input }) {
          return yield* UsersService.use((s) => s.getStaffMembersByDomain({ domain: input.domain }))
        }),
      ),
    ),

  getStaffAccessById: domainProcedure
    .input(Schema.toStandardSchemaV1(GetStaffMemberByIdInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('UsersRouter.getStaffAccessById')(function* ({ input }) {
          return yield* UsersService.use((s) =>
            s.getStaffAccessById({
              accessId: input.accessId,
              domain: input.domain,
            }),
          )
        }),
      ),
    ),

  createStaffMember: domainProcedure
    .input(Schema.toStandardSchemaV1(CreateStaffMemberInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('UsersRouter.createStaffMember')(function* ({ input }) {
          return yield* UsersService.use((s) =>
            s.createStaffMember({
              domain: input.domain,
              data: input.data,
            }),
          )
        }),
      ),
    ),

  deleteStaffAccess: domainProcedure
    .input(Schema.toStandardSchemaV1(DeleteUserMarathonRelationInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('UsersRouter.deleteStaffAccess')(function* ({ input }) {
          return yield* UsersService.use((s) =>
            s.deleteStaffAccess({
              domain: input.domain,
              accessId: input.accessId,
            }),
          )
        }),
      ),
    ),

  getVerificationsByStaffId: domainProcedure
    .input(Schema.toStandardSchemaV1(GetVerificationsByStaffIdInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('UsersRouter.getVerificationsByStaffId')(function* ({ input }) {
          return yield* UsersService.use((s) =>
            s.getVerificationsByStaffId({
              staffId: input.staffId,
              domain: input.domain,
              cursor: input.cursor ?? undefined,
              limit: input.limit ?? undefined,
            }),
          )
        }),
      ),
    ),

  updateStaffAccess: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateStaffMemberInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('UsersRouter.updateStaffAccess')(function* ({ input }) {
          return yield* UsersService.use((s) =>
            s.updateStaffAccess({
              accessId: input.accessId,
              domain: input.domain,
              data: input.data,
            }),
          )
        }),
      ),
    ),
})
