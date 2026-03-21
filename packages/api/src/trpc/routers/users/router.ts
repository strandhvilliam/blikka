import "server-only";

import { Effect } from "effect";
import {
  createTRPCRouter,
  domainProcedure,
  requireMatchingInputDomainMiddleware,
} from "../../root";
import { trpcEffect } from "../../utils";
import {
  GetStaffMembersByDomainInputSchema,
  GetStaffMemberByIdInputSchema,
  CreateStaffMemberInputSchema,
  DeleteUserMarathonRelationInputSchema,
  GetVerificationsByStaffIdInputSchema,
  UpdateStaffMemberInputSchema,
} from "./schemas";
import { UsersApiService } from "./service";

export const usersRouter = createTRPCRouter({
  getStaffMembersByDomain: domainProcedure
    .input(GetStaffMembersByDomainInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("UsersRouter.getStaffMembersByDomain")(function* ({ input }) {
          return yield* UsersApiService.use((s) =>
            s.getStaffMembersByDomain({ domain: input.domain }),
          );
        }),
      ),
    ),

  getStaffAccessById: domainProcedure
    .input(GetStaffMemberByIdInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("UsersRouter.getStaffAccessById")(function* ({ input }) {
          return yield* UsersApiService.use((s) =>
            s.getStaffAccessById({
              accessId: input.accessId,
              domain: input.domain,
            }),
          );
        }),
      ),
    ),

  createStaffMember: domainProcedure
    .input(CreateStaffMemberInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("UsersRouter.createStaffMember")(function* ({ input }) {
          return yield* UsersApiService.use((s) =>
            s.createStaffMember({
              domain: input.domain,
              data: input.data,
            }),
          );
        }),
      ),
    ),

  deleteStaffAccess: domainProcedure
    .input(DeleteUserMarathonRelationInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("UsersRouter.deleteStaffAccess")(function* ({
          input,
        }) {
          return yield* UsersApiService.use((s) =>
            s.deleteStaffAccess({
              domain: input.domain,
              accessId: input.accessId,
            }),
          );
        }),
      ),
    ),

  getVerificationsByStaffId: domainProcedure
    .input(GetVerificationsByStaffIdInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("UsersRouter.getVerificationsByStaffId")(function* ({
          input,
        }) {
          return yield* UsersApiService.use((s) =>
            s.getVerificationsByStaffId({
              staffId: input.staffId,
              domain: input.domain,
              cursor: input.cursor ?? undefined,
              limit: input.limit ?? undefined,
            }),
          );
        }),
      ),
    ),

  updateStaffAccess: domainProcedure
    .input(UpdateStaffMemberInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("UsersRouter.updateStaffAccess")(function* ({ input }) {
          return yield* UsersApiService.use((s) =>
            s.updateStaffAccess({
              accessId: input.accessId,
              domain: input.domain,
              data: input.data,
            }),
          );
        }),
      ),
    ),
});
