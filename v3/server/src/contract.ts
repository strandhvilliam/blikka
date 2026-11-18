import * as Schema from "effect/Schema";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import { Authenticated } from "./auth/Authenticated.ts";
import { BallotsApi } from "./ballots/endpoints.ts";
import { CompetitionsApi } from "./competitions/endpoints.ts";
import { InvitationsApi } from "./invitations/endpoints.ts";
import { MembersApi } from "./members/endpoints.ts";
import { OrganizationsApi } from "./organizations/endpoints.ts";
import { EntryApi } from "./entry/endpoints.ts";
import { ParticipantsApi } from "./participants/endpoints.ts";
import { RoundsApi } from "./rounds/endpoints.ts";
import { SubmissionsApi } from "./submissions/endpoints.ts";
import { TopicsApi } from "./topics/endpoints.ts";
import { VotersApi } from "./voters/endpoints.ts";

export const User = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
});

export type User = typeof User.Type;

export class UsersApi extends HttpApiGroup.make("users")
  .add(HttpApiEndpoint.get("me", "/me", { success: Schema.Struct({ user: User }) }))
  .middleware(Authenticated) {}

export class Api extends HttpApi.make("blikka")
  .add(UsersApi)
  .add(OrganizationsApi)
  .add(CompetitionsApi)
  .add(TopicsApi)
  .add(EntryApi)
  .add(ParticipantsApi)
  .add(SubmissionsApi)
  .add(InvitationsApi)
  .add(MembersApi)
  .add(RoundsApi)
  .add(VotersApi)
  .add(BallotsApi) {}
