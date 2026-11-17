import * as Schema from "effect/Schema";
import { Role } from "../permissions/permissions.ts";

export const Member = Schema.Struct({
  user_id: Schema.String,
  organization_id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Role,
});

export class MemberNotFound extends Schema.TaggedError<MemberNotFound>()(
  "MemberNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class OwnerCannotBeRemoved extends Schema.TaggedError<OwnerCannotBeRemoved>()(
  "OwnerCannotBeRemoved",
  {},
  { httpApiStatus: 409 },
) {}
