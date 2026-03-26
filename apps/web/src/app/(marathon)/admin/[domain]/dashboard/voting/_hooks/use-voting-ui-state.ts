import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs"


export function useVotingUiState() {
  const [params, setParams] = useQueryStates({
    tab: parseAsStringEnum([
      "leaderboard",
      "voters",
    ]).withDefault("leaderboard"),
    leaderboardPage: parseAsInteger.withDefault(1),
    leaderboardRoundId: parseAsInteger,
    votersPage: parseAsInteger.withDefault(1),
  })
  return {
    activeTab: params.tab,
    setActiveTab: (tab: "leaderboard" | "voters") => setParams({ ...params, tab }),
    leaderboardPage: params.leaderboardPage,
    setLeaderboardPage: (page: number) => setParams({ ...params, leaderboardPage: page }),
    leaderboardRoundId: params.leaderboardRoundId,
    setLeaderboardRoundId: (roundId: number | null) =>
      setParams({
        ...params,
        leaderboardRoundId: roundId,
        leaderboardPage: 1,
      }),
    votersPage: params.votersPage,
    setVotersPage: (page: number) => setParams({ ...params, votersPage: page }),
    setParams,
  }
} 