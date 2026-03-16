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

  getStaffMemberById: domainProcedure
    .input(GetStaffMemberByIdInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn("UsersRouter.getStaffMemberById")(function* ({ input }) {
          return yield* UsersApiService.use((s) =>
            s.getStaffMemberById({
              staffId: input.staffId,
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

  deleteUserMarathonRelation: domainProcedure
    .input(DeleteUserMarathonRelationInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("UsersRouter.deleteUserMarathonRelation")(function* ({
          input,
        }) {
          return yield* UsersApiService.use((s) =>
            s.deleteUserMarathonRelation({
              domain: input.domain,
              userId: input.userId,
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

  updateStaffMember: domainProcedure
    .input(UpdateStaffMemberInputSchema)
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn("UsersRouter.updateStaffMember")(function* ({ input }) {
          return yield* UsersApiService.use((s) =>
            s.updateStaffMember({
              staffId: input.staffId,
              domain: input.domain,
              data: input.data,
            }),
          );
        }),
      ),
    ),
});
