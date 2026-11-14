import * as Schema from "effect/Schema";
import { Role } from "../permissions/permissions.ts";

export const Member = Schema.Struct({
  user_id: Schema.String,
  organization_id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Role,
});

// Also for a member of someone else's organization, so the ids give nothing away.
export class MemberNotFound extends Schema.TaggedError<MemberNotFound>()(
  "MemberNotFound",
  {},
  { httpApiStatus: 404 },
) {}

// The owner hands ownership over first (adr/0001).
export class OwnerCannotBeRemoved extends Schema.TaggedError<OwnerCannotBeRemoved>()(
  "OwnerCannotBeRemoved",
  {},
  { httpApiStatus: 409 },
) {}
