import { Schema } from "effect"

export const GetStaffMembersByDomainInputSchema = Schema.Struct({ domain: Schema.String });

export const GetStaffMemberByIdInputSchema = Schema.Struct({
    accessId: Schema.String,
    domain: Schema.String,
  });

export const CreateStaffMemberInputSchema = Schema.Struct({
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.String,
      email: Schema.String,
      role: Schema.Literals(["staff", "admin"]),
    }),
  });

export const DeleteUserMarathonRelationInputSchema = Schema.Struct({
    domain: Schema.String,
    accessId: Schema.String,
  });

export const GetVerificationsByStaffIdInputSchema = Schema.Struct({
    staffId: Schema.String,
    domain: Schema.String,
    cursor: Schema.optional(Schema.Number),
    limit: Schema.optional(Schema.Number),
  });

export const UpdateStaffMemberInputSchema = Schema.Struct({
    accessId: Schema.String,
    domain: Schema.String,
    data: Schema.Struct({
      name: Schema.String,
      email: Schema.String,
      role: Schema.Literals(["staff", "admin"]),
    }),
  });

export type GetStaffMembersByDomainInput = Schema.Schema.Type<typeof GetStaffMembersByDomainInputSchema>
export type GetStaffMemberByIdInput = Schema.Schema.Type<typeof GetStaffMemberByIdInputSchema>
export type CreateStaffMemberInput = Schema.Schema.Type<typeof CreateStaffMemberInputSchema>
export type DeleteUserMarathonRelationInput = Schema.Schema.Type<typeof DeleteUserMarathonRelationInputSchema>
export type GetVerificationsByStaffIdInput = Schema.Schema.Type<typeof GetVerificationsByStaffIdInputSchema>
export type UpdateStaffMemberInput = Schema.Schema.Type<typeof UpdateStaffMemberInputSchema>
