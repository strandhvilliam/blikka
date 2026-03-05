import { Schema } from "effect"

export class UsersApiError extends Schema.TaggedErrorClass<UsersApiError>()(
  "@blikka/api/users-api-error",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
) {
}

export const GetStaffMembersByDomainInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ domain: Schema.String })
)

export const GetStaffMemberByIdInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    staffId: Schema.String,
    domain: Schema.String,
  })
)

export const CreateStaffMemberInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.String,
      email: Schema.String,
      role: Schema.Literals(["staff", "admin"]),
    }),
  })
)

export const DeleteUserMarathonRelationInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    domain: Schema.String,
    userId: Schema.String,
  })
)

export const GetVerificationsByStaffIdInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    staffId: Schema.String,
    domain: Schema.String,
    cursor: Schema.optional(Schema.Number),
    limit: Schema.optional(Schema.Number),
  })
)

export const UpdateStaffMemberInputSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    staffId: Schema.String,
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.String,
      email: Schema.String,
      role: Schema.Literals(["staff", "admin"]),
    }),
  })
)
