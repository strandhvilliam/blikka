import "server-only";

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { createTRPCRouter } from "../root";
import { participantRouter } from "./participants/router";
import { marathonRouter } from "./marathons/router";
import { uploadFlowRouter } from "./upload-flow/router";
import { validationsRouter } from "./validations/router";
import { contactSheetsRouter } from "./contact-sheets/router";
import { topicsRouter } from "./topics/router";
import { competitionClassesRouter } from "./competition-classes/router";
import { deviceGroupsRouter } from "./device-groups/router";
import { rulesRouter } from "./rules/router";
import { usersRouter } from "./users/router";
import { exportsRouter } from "./exports/router";
import { juryRouter } from "./jury/router";
import { sponsorsRouter } from "./sponsors/router";
import { zipFilesRouter } from "./zip-files/router";
import { votingRouter } from "./voting/router";
import { smsRouter } from "./sms/router";
import { submissionsRouter } from "./submissions/router";

export const appRouter = createTRPCRouter({
  participants: participantRouter,
  marathons: marathonRouter,
  uploadFlow: uploadFlowRouter,
  validations: validationsRouter,
  contactSheets: contactSheetsRouter,
  topics: topicsRouter,
  competitionClasses: competitionClassesRouter,
  deviceGroups: deviceGroupsRouter,
  rules: rulesRouter,
  users: usersRouter,
  exports: exportsRouter,
  jury: juryRouter,
  sponsors: sponsorsRouter,
  zipFiles: zipFilesRouter,
  voting: votingRouter,
  sms: smsRouter,
  submissions: submissionsRouter,
});

export type AppRouter = typeof appRouter;
