import { buildS3Url } from "@/lib/utils"
import type { JuryInvitation, JuryParticipant } from "../../_lib/jury-types"

const THUMBNAILS_BUCKET = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
const SUBMISSIONS_BUCKET = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME
const CONTACT_SHEETS_BUCKET = process.env.NEXT_PUBLIC_CONTACT_SHEETS_BUCKET_NAME

export type JuryListParticipant = JuryParticipant & {
  contactSheetKey?: string | null
}

export function getParticipantPreview(participant: JuryListParticipant) {
  if (participant.contactSheetKey) {
    return buildS3Url(CONTACT_SHEETS_BUCKET, participant.contactSheetKey)
  }

  if (participant.submission?.thumbnailKey) {
    return buildS3Url(THUMBNAILS_BUCKET, participant.submission.thumbnailKey)
  }

  return undefined
}

export function getParticipantAssetUrl(
  participant: JuryListParticipant | null | undefined,
  invitation: JuryInvitation,
) {
  if (!participant) return undefined

  if (invitation.inviteType === "class") {
    return buildS3Url(CONTACT_SHEETS_BUCKET, participant.contactSheetKey)
  }

  return (
    buildS3Url(SUBMISSIONS_BUCKET, participant.submission?.previewKey) ??
    buildS3Url(SUBMISSIONS_BUCKET, participant.submission?.key)
  )
}
