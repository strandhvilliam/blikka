export type VotingLifecycleState = "not-started" | "active" | "ended"
export type VotingUnavailableReason = Exclude<VotingLifecycleState, "active">
export type SubmissionLifecycleState = "open" | "ended"

type NullableTimestamp = string | null | undefined

type VotingSchedule = {
  startsAt: NullableTimestamp
  endsAt: NullableTimestamp
}

function parseTimestamp(value: NullableTimestamp) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

export function getVotingLifecycleState(
  schedule: VotingSchedule,
  now = new Date(),
): VotingLifecycleState {
  const startsAt = parseTimestamp(schedule.startsAt)
  if (!startsAt || startsAt > now) {
    return "not-started"
  }

  const endsAt = parseTimestamp(schedule.endsAt)
  if (endsAt && endsAt <= now) {
    return "ended"
  }

  return "active"
}

export function getVotingUnavailableReason(
  schedule: VotingSchedule,
  now = new Date(),
): VotingUnavailableReason | null {
  const state = getVotingLifecycleState(schedule, now)
  return state === "active" ? null : state
}

export function getSubmissionLifecycleState(
  scheduledEnd: NullableTimestamp,
  now = new Date(),
): SubmissionLifecycleState {
  const endsAt = parseTimestamp(scheduledEnd)
  if (endsAt && endsAt <= now) {
    return "ended"
  }

  return "open"
}
