function formatWindowDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export type StaffByCameraUploadWindowBlockedState =
  | 'no-active-topic'
  | 'not-opened'
  | 'scheduled'
  | 'closed'

export type StaffMarathonUploadWindowBlockedState = 'not-configured' | 'scheduled' | 'closed'

interface StaffUploadWindowGateProps {
  body: string
  subtitle?: string | null
}

export function StaffUploadWindowGate({ body, subtitle }: StaffUploadWindowGateProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
        Upload window
      </p>
      <h2 className="mt-3 font-gothic text-4xl font-medium leading-none tracking-tight text-foreground">
        Uploads unavailable
      </h2>
      {subtitle ? (
        <p className="mt-2 text-sm font-medium text-foreground/80">{subtitle}</p>
      ) : null}
      <div className="mt-8 w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
        {body}
      </div>
    </div>
  )
}

export function getStaffByCameraUploadWindowGateMessage({
  state,
  scheduledStart,
  scheduledEnd,
}: {
  state: StaffByCameraUploadWindowBlockedState
  scheduledStart: string | null
  scheduledEnd: string | null
}) {
  if (state === 'no-active-topic') {
    return 'There is no active topic for this event. Staff cannot upload until a topic is activated in the dashboard.'
  }

  if (state === 'not-opened') {
    return 'The submission window for this topic has not been opened yet. Open submissions from the dashboard when you are ready.'
  }

  if (state === 'scheduled' && scheduledStart) {
    return `Submissions open ${formatWindowDateTime(scheduledStart)}.`
  }

  if (state === 'scheduled') {
    return 'Submissions are scheduled to open later.'
  }

  return scheduledEnd != null
    ? `Submissions closed ${formatWindowDateTime(scheduledEnd)}.`
    : 'Submissions are closed for this topic.'
}

export function getStaffMarathonUploadWindowGateMessage({
  state,
  startDate,
  endDate,
}: {
  state: StaffMarathonUploadWindowBlockedState
  startDate: string | null
  endDate: string | null
}) {
  if (state === 'not-configured') {
    return 'The upload window for this event has not been configured yet. Complete marathon setup in the dashboard before staff can upload.'
  }

  if (state === 'scheduled' && startDate) {
    return `Uploads open ${formatWindowDateTime(startDate)}.`
  }

  if (state === 'scheduled') {
    return 'Uploads are scheduled to open later.'
  }

  return endDate != null
    ? `Uploads closed ${formatWindowDateTime(endDate)}.`
    : 'Uploads are closed for this marathon.'
}
