import type { SQSEvent } from "aws-lambda"
import { createRule, runValidations } from "@blikka/validation/old/validator"

import { z } from "zod"
import { RuleConfig, RuleKey } from "@blikka/validation/old/types"
import type { RuleConfig as DbRuleConfig } from "@vimmer/api/db/types"
import { db } from "@vimmer/api/db"
import { getParticipantByIdQuery } from "@vimmer/api/db/queries/participants.queries"
import { getMarathonByIdQuery } from "@vimmer/api/db/queries/marathons.queries"
import { getRulesByDomainQuery } from "@vimmer/api/db/queries/rules.queries"
import { getTopicsByMarathonIdQuery } from "@vimmer/api/db/queries/topics.queries"
import { createMultipleValidationResultsMutation } from "@vimmer/api/db/queries/validations.queries"

// Function to map database rule configs to validation rule configs
function mapDbRuleConfigsToValidationConfigs(dbRuleConfigs: DbRuleConfig[]): RuleConfig<RuleKey>[] {
  return dbRuleConfigs
    .filter((rule) => rule.enabled) // Only include enabled rules
    .map((rule) => {
      const ruleKey = rule.ruleKey as RuleKey
      const severity = rule.severity as "error" | "warning"

      return createRule(ruleKey, severity, rule.params as any)
    })
}

const validationInputSchema = z.object({
  exif: z.record(z.unknown(), { message: "No exif data found" }),
  fileName: z.string().min(1, { message: "File name is required" }),
  fileSize: z.number().nonnegative({ message: "File size is required" }),
  mimeType: z.string().min(1, { message: "Mime type is required" }),
  orderIndex: z.number().int().nonnegative(),
})

export const handler = async (event: SQSEvent): Promise<void> => {
  const records = event.Records
  for (const record of records) {
    const parsedBody = JSON.parse(record.body) as { participantId: number }
    const participantId = parsedBody.participantId

    if (!participantId) {
      throw new Error("Participant id is required")
    }

    const participant = await getParticipantByIdQuery(db, {
      id: participantId,
    })

    if (!participant) {
      //TODO: Add error NOT ABLE TO VALIDATE
      throw new Error(`Participant with id ${participantId} not found`)
    }

    const marathon = await getMarathonByIdQuery(db, {
      id: participant.marathonId,
    })

    if (!marathon) {
      //TODO: Add error NOT ABLE TO VALIDATE
      throw new Error(`Marathon with id ${participant.marathonId} not found`)
    }

    if (participant.status === "verified") {
      console.log("Participant is already verified, skipping")
      continue
    }

    const dbRuleConfigs = await getRulesByDomainQuery(db, {
      domain: marathon.domain,
    })

    const ruleConfigs = mapDbRuleConfigsToValidationConfigs(dbRuleConfigs)

    const topics = await getTopicsByMarathonIdQuery(db, {
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

    const validationResults = runValidations(ruleConfigs, parsedSubmissions.data).map((r) => ({
      ...r,
      participantId,
    }))

    if (validationResults.length > 0) {
      await createMultipleValidationResultsMutation(db, {
        data: validationResults,
      })
    }
  }
}
