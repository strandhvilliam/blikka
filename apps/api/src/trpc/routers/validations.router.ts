import {
  getValidationResultsByParticipantIdQuery,
  getParticipantVerificationsByStaffIdQuery,
  getAllParticipantVerificationsQuery,
  createValidationResultMutation,
  createMultipleValidationResultsMutation,
  updateValidationResultMutation,
  createParticipantVerificationMutation,
  clearAllValidationResultsMutation,
  getValidationResultsByDomainQuery,
} from "@vimmer/api/db/queries/validations.queries"
import { createTRPCRouter, publicProcedure } from ".."
import {
  getValidationResultsByParticipantIdSchema,
  getParticipantVerificationsByStaffIdSchema,
  getAllParticipantVerificationsSchema,
  createValidationResultSchema,
  createMultipleValidationResultsSchema,
  updateValidationResultSchema,
  createParticipantVerificationSchema,
  runValidationsSchema,
  getValidationResultsByDomainSchema,
} from "@vimmer/api/schemas/validations.schemas"
import {
  getParticipantByIdQuery,
  updateParticipantMutation,
} from "@vimmer/api/db/queries/participants.queries"
import { getMarathonByIdQuery } from "@vimmer/api/db/queries/marathons.queries"
import { getRulesByDomainQuery } from "@vimmer/api/db/queries/rules.queries"
import type { RuleConfig, RuleKey } from "../../../../../packages/validation/old/types"
import { createRule, runValidations } from "@blikka/validation/validator"
import type { RuleConfig as DbRuleConfig } from "@vimmer/api/db/types"
import { getTopicsByMarathonIdQuery } from "@vimmer/api/db/queries/topics.queries"
import { z } from "zod"
import { publishToRealtime } from "@vimmer/api/utils/publish-to-realtime"

const validationInputSchema = z.object({
  exif: z.record(z.unknown(), { message: "No exif data found" }),
  fileName: z.string().min(1, { message: "File name is required" }),
  fileSize: z.number().nonnegative({ message: "File size is required" }),
  orderIndex: z.number().int().nonnegative(),
  mimeType: z.string().min(1, { message: "Mime type is required" }),
})

export const validationsRouter = createTRPCRouter({
  getValidationResultsByParticipantId: publicProcedure
    .input(getValidationResultsByParticipantIdSchema)
    .query(async ({ ctx, input }) => {
      return getValidationResultsByParticipantIdQuery(ctx.db, {
        participantId: input.participantId,
      })
    }),

  getParticipantVerificationsByStaffId: publicProcedure
    .input(getParticipantVerificationsByStaffIdSchema)
    .query(async ({ ctx, input }) => {
      return getParticipantVerificationsByStaffIdQuery(ctx.db, {
        staffId: input.staffId,
        domain: input.domain,
      })
    }),

  getAllParticipantVerifications: publicProcedure
    .input(getAllParticipantVerificationsSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await getAllParticipantVerificationsQuery(ctx.db, {
          domain: input.domain,
          page: input.page,
          pageSize: input.pageSize,
          search: input.search,
        })
      } catch (error) {
        console.error(error)
        throw new Error("Failed to get participant verifications")
      }
    }),
  getValidationResultsByDomain: publicProcedure
    .input(getValidationResultsByDomainSchema)
    .query(async ({ ctx, input }) => {
      return getValidationResultsByDomainQuery(ctx.db, {
        domain: input.domain,
      })
    }),

  createValidationResult: publicProcedure
    .input(createValidationResultSchema)
    .mutation(async ({ ctx, input }) => {
      return createValidationResultMutation(ctx.db, {
        data: input.data,
      })
    }),

  createMultipleValidationResults: publicProcedure
    .input(createMultipleValidationResultsSchema)
    .mutation(async ({ ctx, input }) => {
      return createMultipleValidationResultsMutation(ctx.db, {
        data: input.data,
      })
    }),

  updateValidationResult: publicProcedure
    .input(updateValidationResultSchema)
    .mutation(async ({ ctx, input }) => {
      return updateValidationResultMutation(ctx.db, {
        id: input.id,
        data: input.data,
      })
    }),

  createParticipantVerification: publicProcedure
    .input(createParticipantVerificationSchema)
    .mutation(async ({ ctx, input }) => {
      const { id } = await createParticipantVerificationMutation(ctx.db, {
        data: input.data,
      })

      await updateParticipantMutation(ctx.db, {
        id: input.data.participantId,
        data: {
          status: "verified",
        },
      })

      await publishToRealtime({
        participantId: input.data.participantId,
        status: "verified",
      })

      return { id }
    }),

  runValidations: publicProcedure.input(runValidationsSchema).mutation(async ({ ctx, input }) => {
    const participantId = input.participantId

    if (!participantId) {
      throw new Error("Participant id is required")
    }

    const participant = await getParticipantByIdQuery(ctx.db, {
      id: participantId,
    })

    if (!participant) {
      //TODO: Add error NOT ABLE TO VALIDATE
      throw new Error(`Participant with id ${participantId} not found`)
    }

    const marathon = await getMarathonByIdQuery(ctx.db, {
      id: participant.marathonId,
    })

    if (!marathon) {
      //TODO: Add error NOT ABLE TO VALIDATE
      throw new Error(`Marathon with id ${participant.marathonId} not found`)
    }

    const dbRuleConfigs = await getRulesByDomainQuery(ctx.db, {
      domain: marathon.domain,
    })

    const mapDbRuleConfigsToValidationConfigs = (
      dbRuleConfigs: DbRuleConfig[]
    ): RuleConfig<RuleKey>[] => {
      return dbRuleConfigs
        .filter((rule) => rule.enabled)
        .map((rule) => {
          const ruleKey = rule.ruleKey as RuleKey
          const severity = rule.severity as "error" | "warning"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return createRule(ruleKey, severity, rule.params as any)
        })
    }

    const ruleConfigs = mapDbRuleConfigsToValidationConfigs(dbRuleConfigs)

    const topics = await getTopicsByMarathonIdQuery(ctx.db, {
      id: participant.marathonId,
    })

    const parsedSubmissions = z.array(validationInputSchema).safeParse(
      participant.submissions.map((s) => ({
        exif: s.exif,
        fileName: s.key,
        fileSize: s.size,
        mimeType: s.mimeType,
        orderIndex: topics.find((t) => t.id === s.topicId)?.orderIndex,
      }))
    )

    if (!parsedSubmissions.success) {
      //TODO: Add error MISSING REQUIRED FIELDS
      throw new Error(`Invalid submissions: ${parsedSubmissions.error}`)
    }

    // Clear all existing validation results before running new validations
    await clearAllValidationResultsMutation(ctx.db, {
      participantId,
    })

    const validationResults = runValidations(ruleConfigs, parsedSubmissions.data).map((r) => ({
      ...r,
      participantId,
    }))

    if (validationResults.length > 0) {
      await createMultipleValidationResultsMutation(ctx.db, {
        data: validationResults,
      })
    }
  }),
})
