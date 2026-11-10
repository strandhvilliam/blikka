import * as Context from "effect/Context";
import type { User } from "../contract.ts";

// The signed-in caller. Only endpoints behind the Authenticated middleware have it, so a handler
// that reads it without the middleware doesn't compile.
export class CurrentUser extends Context.Service<CurrentUser, typeof User.Type>()(
  "blikka/auth/CurrentUser",
) {}
