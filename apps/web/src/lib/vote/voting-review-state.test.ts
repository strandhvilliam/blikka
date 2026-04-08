import { describe, expect, it } from "vitest"

import { getVotingReviewStats, sanitizeVotingState } from "./voting-review-state"
import type { VotingSubmission } from "./voting-submission"

const submissions: VotingSubmission[] = [
  {
    submissionId: 1,
    participantId: 11,
    topicId: 101,
    topicName: "Topic",
    url: "https://example.com/1.jpg",
    thumbnailUrl: "https://example.com/1-thumb.jpg",
    previewUrl: "https://example.com/1-preview.jpg",
    isOwnSubmission: false,
  },
  {
    submissionId: 2,
    participantId: 22,
    topicId: 101,
    topicName: "Topic",
    url: "https://example.com/2.jpg",
    thumbnailUrl: "https://example.com/2-thumb.jpg",
    previewUrl: "https://example.com/2-preview.jpg",
    isOwnSubmission: true,
  },
  {
    submissionId: 3,
    participantId: 33,
    topicId: 101,
    topicName: "Topic",
    url: "https://example.com/3.jpg",
    thumbnailUrl: "https://example.com/3-thumb.jpg",
    previewUrl: "https://example.com/3-preview.jpg",
    isOwnSubmission: false,
  },
]

describe("voting review state", () => {
  it("removes stale ratings and selections for own submissions", () => {
    expect(
      sanitizeVotingState({
        submissions,
        ratings: {
          1: 5,
          2: 4,
          99: 3,
        },
        selectedSubmissionId: 2,
      }),
    ).toEqual({
      hasChanges: true,
      ratings: {
        1: 5,
      },
      selectedSubmissionId: null,
    })
  })

  it("counts review progress only across rateable submissions", () => {
    expect(
      getVotingReviewStats({
        submissions,
        ratings: {
          1: 5,
          2: 4,
          3: 2,
        },
        selectedSubmissionId: 2,
      }),
    ).toEqual({
      total: 2,
      rated: 2,
      unrated: 0,
      hasCompletedReview: true,
      hasSelectedFinal: false,
      ratingCounts: {
        1: 0,
        2: 1,
        3: 0,
        4: 0,
        5: 1,
      },
    })
  })
})
