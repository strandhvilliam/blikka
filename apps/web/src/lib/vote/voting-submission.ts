export interface VotingSubmission {
  submissionId: number
  participantId: number
  url?: string
  thumbnailUrl?: string
  topicId: number
  topicName: string
  isOwnSubmission: boolean
}
