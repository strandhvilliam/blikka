import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@blikka/api-v2/trpc"

type RouterOutputs = inferRouterOutputs<AppRouter>

export type JuryInvitation = RouterOutputs["jury"]["verifyTokenAndGetInitialData"]
export type JuryRatingsResponse = RouterOutputs["jury"]["getJuryRatingsByInvitation"]
export type JurySubmissionPage = RouterOutputs["jury"]["getJurySubmissionsFromToken"]
export type JuryParticipant = JurySubmissionPage["participants"][number]
