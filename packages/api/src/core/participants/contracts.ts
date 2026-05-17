import type { NewParticipant } from '@blikka/db'
import { Schema } from 'effect'

export const GetPublicParticipantByReferenceInputSchema = Schema.Struct({
  reference: Schema.String,
  domain: Schema.String,
})

export const GetByDomainInfiniteInputSchema = Schema.Struct({
  domain: Schema.String,
  cursor: Schema.NullishOr(Schema.String),
  limit: Schema.NullishOr(
    Schema.Number.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(100)),
  ),
  search: Schema.NullishOr(Schema.String),
  sortOrder: Schema.NullishOr(Schema.Literals(['asc', 'desc'])),
  competitionClassId: Schema.NullishOr(Schema.Union([Schema.Number, Schema.Array(Schema.Number)])),
  deviceGroupId: Schema.NullishOr(Schema.Union([Schema.Number, Schema.Array(Schema.Number)])),
  topicId: Schema.NullishOr(Schema.Number),
  statusFilter: Schema.NullishOr(Schema.Literals(['completed', 'verified'])),
  excludeStatuses: Schema.NullishOr(Schema.Array(Schema.String)),
  includeStatuses: Schema.NullishOr(Schema.Array(Schema.String)),
  hasValidationErrors: Schema.NullishOr(Schema.Boolean),
  votedFilter: Schema.NullishOr(Schema.Literals(['voted', 'not-voted'])),
})

export const GetByReferenceInputSchema = Schema.Struct({
  reference: Schema.String,
  domain: Schema.String,
})

export const BatchDeleteInputSchema = Schema.Struct({
  ids: Schema.Array(Schema.Number),
  domain: Schema.String,
})

export const BatchVerifyInputSchema = Schema.Struct({
  ids: Schema.Array(Schema.Number),
  domain: Schema.String,
})

export const BatchMarkCompletedInputSchema = Schema.Struct({
  ids: Schema.Array(Schema.Number),
  domain: Schema.String,
})

export const VerifyParticipantInputSchema = Schema.Struct({
  id: Schema.Number,
  domain: Schema.String,
})

export const UpdateByCameraParticipantContactInputSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
  firstname: Schema.String,
  lastname: Schema.String,
  email: Schema.String,
  phone: Schema.String,
})

export const UpdateMarathonParticipantContactInputSchema = Schema.Struct({
  domain: Schema.String,
  reference: Schema.String,
  firstname: Schema.String,
  lastname: Schema.String,
  email: Schema.String,
})

export const PublicParticipantSchema = Schema.Struct({
  reference: Schema.String,
  domain: Schema.String,
  status: Schema.String,
  publicSubmissions: Schema.Array(
    Schema.Struct({
      topic: Schema.Struct({
        name: Schema.String,
        orderIndex: Schema.Number,
      }),
      status: Schema.String,
      createdAt: Schema.String,
      key: Schema.NullOr(Schema.String),
      thumbnailKey: Schema.NullOr(Schema.String),
    }),
  ),
  competitionClass: Schema.Struct({
    name: Schema.String,
    description: Schema.String,
  }),
  deviceGroup: Schema.Struct({
    name: Schema.String,
    description: Schema.String,
    icon: Schema.String,
  }),
})

export type GetPublicParticipantByReferenceInput = Schema.Schema.Type<
  typeof GetPublicParticipantByReferenceInputSchema
>
export type GetByDomainInfiniteInput = Schema.Schema.Type<typeof GetByDomainInfiniteInputSchema>
export type GetByReferenceInput = Schema.Schema.Type<typeof GetByReferenceInputSchema>
export type BatchDeleteInput = Schema.Schema.Type<typeof BatchDeleteInputSchema>
export type BatchVerifyInput = Schema.Schema.Type<typeof BatchVerifyInputSchema>
export type BatchMarkCompletedInput = Schema.Schema.Type<typeof BatchMarkCompletedInputSchema>
export type VerifyParticipantInput = Schema.Schema.Type<typeof VerifyParticipantInputSchema>
export type UpdateByCameraParticipantContactInput = Schema.Schema.Type<
  typeof UpdateByCameraParticipantContactInputSchema
>
export type UpdateMarathonParticipantContactInput = Schema.Schema.Type<
  typeof UpdateMarathonParticipantContactInputSchema
>
export type PublicParticipant = Schema.Schema.Type<typeof PublicParticipantSchema>

/** Insert payload minus phone-secret columns; the participant service hashes/encrypts optional `phoneNumber`. */
export type CreateParticipantParticipantRow = Omit<NewParticipant, 'phoneHash' | 'phoneEncrypted'>

export type CreateParticipantInput = {
  data: CreateParticipantParticipantRow
  phoneNumber?: string | undefined
}
