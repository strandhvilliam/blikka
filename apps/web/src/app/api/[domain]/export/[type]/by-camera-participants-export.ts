export interface ByCameraAllTopicsParticipantExportRow {
  reference: string | null
  firstname: string
  lastname: string
  email: string
  phoneNumber: string
  status: string | null
  competitionClassName: string
  deviceGroupName: string
  createdAt: string | null
  topicsParticipatedCount: number
  latestTopicName: string
  latestUploadedAt: string | null
}

function formatSpreadsheetDate(value: string | null | undefined): string {
  if (!value) return "N/A"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "N/A"

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")

  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

export function formatByCameraAllTopicsParticipantRows(
  participantsData: ByCameraAllTopicsParticipantExportRow[],
) {
  return participantsData.map((participant) => ({
    Reference: participant.reference,
    "First Name": participant.firstname,
    "Last Name": participant.lastname,
    Email: participant.email,
    "Phone Number": participant.phoneNumber,
    Status: participant.status ?? "",
    "Competition Class": participant.competitionClassName,
    "Device Group": participant.deviceGroupName,
    "Created At": participant.createdAt
      ? new Date(participant.createdAt).toLocaleDateString()
      : "",
    "Topics Participated In": participant.topicsParticipatedCount,
    "Latest Topic": participant.latestTopicName,
    "Latest Uploaded": formatSpreadsheetDate(participant.latestUploadedAt),
  }))
}
