import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs"


export function useVotingUiState() {
  const [params, setParams] = useQueryStates({
    tab: parseAsStringEnum([
      "leaderboard",
      "voters",
    ]).withDefault("leaderboard"),
    leaderboardPage: parseAsInteger.withDefault(1),
    votersPage: parseAsInteger.withDefault(1),
  })
  return {
    activeTab: params.tab,
    setActiveTab: (tab: "leaderboard" | "voters") => setParams({ ...params, tab }),
    leaderboardPage: params.leaderboardPage,
    setLeaderboardPage: (page: number) => setParams({ ...params, leaderboardPage: page }),
    votersPage: params.votersPage,
    setVotersPage: (page: number) => setParams({ ...params, votersPage: page }),
    setParams,
  }
} 