import * as Schema from "effect/Schema";

export const Invitation = Schema.Struct({
  id: Schema.String,
  organization_id: Schema.String,
  email: Schema.String,
  expires_at: Schema.Date,
});

export const ReceivedInvitation = Schema.Struct({
  id: Schema.String,
  organization: Schema.Struct({ id: Schema.String, name: Schema.String }),
  invited_by: Schema.Struct({ name: Schema.String, email: Schema.String }),
  expires_at: Schema.Date,
});

export const InvitationEmail = Schema.Trim.check(Schema.isPattern(/^[^\s@]+@[^\s@]+$/), Schema.isMaxLength(254));

export class AlreadyMember extends Schema.TaggedError<AlreadyMember>()("AlreadyMember", {}, { httpApiStatus: 409 }) {}

export class InvitationNotFound extends Schema.TaggedError<InvitationNotFound>()(
  "InvitationNotFound",
  {},
  { httpApiStatus: 404 },
) {}
