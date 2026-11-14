import * as Schema from "effect/Schema";
import { Role } from "../permissions/permissions.ts";

export const Member = Schema.Struct({
  user_id: Schema.String,
  organization_id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Role,
});
