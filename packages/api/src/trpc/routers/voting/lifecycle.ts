export type VotingLifecycleState = "not-started" | "active" | "ended"

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
    throw new Error("Invalid voting timestamp")
  }

  return date
}

export function parseVotingScheduleInput({
  startsAt,
  endsAt,
}: {
  startsAt: string
  endsAt?: string | null
}) {
  const startsAtDate = parseTimestamp(startsAt)
  if (!startsAtDate) {
    throw new Error("Invalid startsAt timestamp")
  }

  const endsAtDate = parseTimestamp(endsAt)
  if (endsAtDate && startsAtDate >= endsAtDate) {
    throw new Error("endsAt must be later than startsAt")
  }

  return {
    startsAtIso: startsAtDate.toISOString(),
    endsAtIso: endsAtDate ? endsAtDate.toISOString() : null,
  }
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

export function hasSubmissionWindowEnded(
  scheduledEnd: NullableTimestamp,
  now = new Date(),
) {
  const scheduledEndDate = parseTimestamp(scheduledEnd)
  return !!scheduledEndDate && scheduledEndDate <= now
}
