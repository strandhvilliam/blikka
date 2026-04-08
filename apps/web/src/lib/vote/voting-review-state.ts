import type { VotingSubmission } from "./voting-submission"

interface SanitizeVotingStateOptions {
  submissions: VotingSubmission[]
  ratings: Record<number, number | undefined>
  selectedSubmissionId: number | null
}

interface VotingReviewStats {
  total: number
  rated: number
  unrated: number
  hasCompletedReview: boolean
  hasSelectedFinal: boolean
  ratingCounts: Record<number, number>
}

export function sanitizeVotingState({
  submissions,
  ratings,
  selectedSubmissionId,
}: SanitizeVotingStateOptions) {
  const rateableSubmissionIds = new Set(
    submissions
      .filter((submission) => !submission.isOwnSubmission)
      .map((submission) => submission.submissionId),
  )

  const allSubmissionIds = new Set(submissions.map((submission) => submission.submissionId))

  let hasChanges = false
  const nextRatings: Record<number, number> = {}

  for (const [key, value] of Object.entries(ratings)) {
    const submissionId = parseInt(key, 10)

    if (
      !Number.isNaN(submissionId) &&
      allSubmissionIds.has(submissionId) &&
      rateableSubmissionIds.has(submissionId) &&
      value !== undefined &&
      value !== null
    ) {
      nextRatings[submissionId] = value
      continue
    }

    hasChanges = true
  }

  const nextSelectedSubmissionId =
    selectedSubmissionId !== null && rateableSubmissionIds.has(selectedSubmissionId)
      ? selectedSubmissionId
      : null

  if (nextSelectedSubmissionId !== selectedSubmissionId) {
    hasChanges = true
  }

  return {
    hasChanges,
    ratings: nextRatings,
    selectedSubmissionId: nextSelectedSubmissionId,
  }
}

export function getVotingReviewStats({
  submissions,
  ratings,
  selectedSubmissionId,
}: SanitizeVotingStateOptions): VotingReviewStats {
  const rateableSubmissions = submissions.filter((submission) => !submission.isOwnSubmission)
  const rateableSubmissionIds = new Set(
    rateableSubmissions.map((submission) => submission.submissionId),
  )

  const ratingCounts: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }

  let rated = 0
  for (const submission of rateableSubmissions) {
    const rating = ratings[submission.submissionId]
    if (rating === undefined) continue

    rated++

    if (rating >= 1 && rating <= 5) {
      ratingCounts[rating]++
    }
  }

  const total = rateableSubmissions.length

  return {
    total,
    rated,
    unrated: total - rated,
    hasCompletedReview: rated === total && total > 0,
    hasSelectedFinal:
      selectedSubmissionId !== null && rateableSubmissionIds.has(selectedSubmissionId),
    ratingCounts,
  }
}
