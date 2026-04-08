import type { VotingUnavailableReason } from "@/lib/voting-lifecycle"

export function getVotingUnavailableContent(reason: string | null) {
  const resolvedReason: VotingUnavailableReason | "unknown" =
    reason === "not-started" || reason === "ended" ? reason : "unknown"

  if (resolvedReason === "not-started") {
    return {
      title: "Voting Has Not Started Yet",
      description:
        "The voting period for this session hasn't started yet. Please check back later.",
      hint: "You'll be able to vote once voting starts for this topic.",
    }
  }

  if (resolvedReason === "ended") {
    return {
      title: "Voting Has Ended",
      description: "The voting period for this session has ended. Thank you for your interest.",
      hint: "The voting window has closed for this topic.",
    }
  }

  return {
    title: "Voting Is Not Available",
    description: "Voting is not available at this time.",
    hint: "This link may be inactive or the voting period may not have started.",
  }
}
