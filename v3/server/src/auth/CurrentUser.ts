import * as Context from "effect/Context";
import type { User } from "../contract.ts";

export class CurrentUser extends Context.Service<CurrentUser, User>()(
  "blikka/auth/CurrentUser",
) {}
