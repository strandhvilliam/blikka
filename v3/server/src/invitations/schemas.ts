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
  invited_by: Schema.Struct({ name: Schema.String }),
  expires_at: Schema.Date,
});

// Loose on purpose: signing in with the address is what proves it, not its shape.
export const InvitationEmail = Schema.Trim.check(Schema.isPattern(/^[^\s@]+@[^\s@]+$/), Schema.isMaxLength(254));

export class AlreadyMember extends Schema.TaggedError<AlreadyMember>()(
  "AlreadyMember",
  {},
  { httpApiStatus: 409 },
) {}

// Also for someone else's, so the id gives nothing away.
export class InvitationNotFound extends Schema.TaggedError<InvitationNotFound>()(
  "InvitationNotFound",
  {},
  { httpApiStatus: 404 },
) {}
