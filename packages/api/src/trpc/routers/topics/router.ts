import "server-only";

import { Effect } from "effect";
import { createTRPCRouter, domainProcedure } from "../../root";
import { trpcEffect } from "../../utils";
import {
  CreateTopicInputSchema,
  UpdateTopicInputSchema,
  DeleteTopicInputSchema,
  UpdateTopicsOrderInputSchema,
  GetTopicsWithSubmissionCountInputSchema,
  ActivateTopicInputSchema,
} from "./schemas";
import { TopicsApiService } from "./service";

export const topicsRouter = createTRPCRouter({
  getWithSubmissionCount: domainProcedure
    .input(GetTopicsWithSubmissionCountInputSchema)
    .query(
      trpcEffect(
        Effect.fn("TopicsRouter.getWithSubmissionCount")(function* ({ input }) {
          return yield* TopicsApiService.use((s) =>
            s.getTopicsWithSubmissionCount({
              domain: input.domain,
            })
          );
        }),
      ),
    ),
  create: domainProcedure.input(CreateTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.create")(function* ({ input }) {
        return yield* TopicsApiService.use((s) =>
          s.createTopic({
            domain: input.domain,
            data: input.data,
          })
        );
      }),
    ),
  ),

  update: domainProcedure.input(UpdateTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.update")(function* ({ input }) {
        return yield* TopicsApiService.use((s) =>
          s.updateTopic({
            id: input.id,
            data: input.data,
          })
        );
      }),
    ),
  ),

  activate: domainProcedure.input(ActivateTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.activate")(function* ({ input }) {
        return yield* TopicsApiService.use((s) =>
          s.activateTopic({
            id: input.id,
          })
        );
      }),
    ),
  ),

  delete: domainProcedure.input(DeleteTopicInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.delete")(function* ({ input }) {
        return yield* TopicsApiService.use((s) =>
          s.deleteTopic({
            id: input.id,
            domain: input.domain,
          })
        );
      }),
    ),
  ),

  updateOrder: domainProcedure.input(UpdateTopicsOrderInputSchema).mutation(
    trpcEffect(
      Effect.fn("TopicsRouter.updateOrder")(function* ({ input }) {
        return yield* TopicsApiService.use((s) =>
          s.updateTopicsOrder({
            domain: input.domain,
            topicIds: input.topicIds,
          })
        );
      }),
    ),
  ),
});
