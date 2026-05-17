import 'server-only'

import { Effect, Schema } from 'effect'
import { createTRPCRouter, domainProcedure, requireMatchingInputDomainMiddleware } from '../root'
import { trpcEffect } from '../utils'
import {
  CreateTopicInputSchema,
  UpdateTopicInputSchema,
  DeleteTopicInputSchema,
  UpdateTopicsOrderInputSchema,
  GetTopicsWithSubmissionCountInputSchema,
  ActivateTopicInputSchema,
} from '../../core/topics/contracts'
import { TopicsService } from '../../core/topics/service'

export const topicsRouter = createTRPCRouter({
  getWithSubmissionCount: domainProcedure
    .input(Schema.toStandardSchemaV1(GetTopicsWithSubmissionCountInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .query(
      trpcEffect(
        Effect.fn('TopicsRouter.getWithSubmissionCount')(function* ({ input }) {
          return yield* TopicsService.use((s) => s.getTopicsWithSubmissionCount(input))
        }),
      ),
    ),
  create: domainProcedure
    .input(Schema.toStandardSchemaV1(CreateTopicInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('TopicsRouter.create')(function* ({ input }) {
          return yield* TopicsService.use((s) => s.createTopic(input))
        }),
      ),
    ),

  update: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateTopicInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('TopicsRouter.update')(function* ({ input }) {
          return yield* TopicsService.use((s) => s.updateTopic(input))
        }),
      ),
    ),

  activate: domainProcedure
    .input(Schema.toStandardSchemaV1(ActivateTopicInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('TopicsRouter.activate')(function* ({ input }) {
          return yield* TopicsService.use((s) => s.activateTopic(input))
        }),
      ),
    ),

  delete: domainProcedure
    .input(Schema.toStandardSchemaV1(DeleteTopicInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('TopicsRouter.delete')(function* ({ input }) {
          return yield* TopicsService.use((s) => s.deleteTopic(input))
        }),
      ),
    ),

  updateOrder: domainProcedure
    .input(Schema.toStandardSchemaV1(UpdateTopicsOrderInputSchema))
    .use(requireMatchingInputDomainMiddleware)
    .mutation(
      trpcEffect(
        Effect.fn('TopicsRouter.updateOrder')(function* ({ input }) {
          return yield* TopicsService.use((s) => s.updateTopicsOrder(input))
        }),
      ),
    ),
})
