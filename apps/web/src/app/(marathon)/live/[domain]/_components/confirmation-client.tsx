"use client"

import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { useSuspenseQuery } from "@tanstack/react-query"
import { buildS3Url, formatDomainPathname } from "@/lib/utils"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { useDesktopCountdownRedirect } from "@/hooks/use-desktop-countdown-redirect"

import { ConfirmationMarathonClient } from "./confirmation-marathon-client"
import { ConfirmationByCameraClient } from "./confirmation-by-camera-client"

const Confetti = dynamic(() => import("react-confetti").then((mod) => mod.default), {
  ssr: false,
})

const THUMBNAILS_BUCKET = process.env.NEXT_PUBLIC_THUMBNAILS_BUCKET_NAME
const SUBMISSIONS_BUCKET = process.env.NEXT_PUBLIC_SUBMISSIONS_BUCKET_NAME

interface ConfirmationClientProps {
  params: {
    participantRef: string
    participantFirstName: string
    participantLastName: string
  }
}

export function ConfirmationClient({ params }: ConfirmationClientProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const t = useTranslations("ConfirmationPage")

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getPublicParticipantByReference.queryOptions({
      reference: params.participantRef ?? "",
      domain,
    }),
  )
  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  )

  const handleRedirect = () => {
    switch (marathon.mode) {
      case "marathon":
        window.location.replace(formatDomainPathname(`/live/marathon`, domain, "live"))
        break
      case "by-camera":
        window.location.replace(formatDomainPathname(`/live/by-camera`, domain, "live"))
        break
    }
  }

  const { remainingSeconds, addSeconds } = useDesktopCountdownRedirect({
    initialSeconds: 15,
    onRedirect: handleRedirect,
  })

  const submissions = participant?.publicSubmissions ? [...participant.publicSubmissions] : []

  const images = submissions
    .sort((a, b) => (a.topic?.orderIndex ?? 0) - (b.topic?.orderIndex ?? 0))
    .map((submission) => ({
      imageUrl:
        buildS3Url(THUMBNAILS_BUCKET, submission.thumbnailKey) ??
        buildS3Url(SUBMISSIONS_BUCKET, submission.key),
      name: submission.topic?.name ?? t("photoPlaceholder") ?? "",
      orderIndex: submission.topic?.orderIndex ?? 0,
    }))

  if (marathon.mode === "by-camera") {
    return (
      <>
        <Confetti recycle={false} numberOfPieces={400} />
        <ConfirmationByCameraClient
          params={params}
          participant={{
            reference: participant.reference,
            deviceGroup: participant.deviceGroup,
            competitionClass: participant.competitionClass,
          }}
          image={images[0] ?? null}
          handleRedirect={handleRedirect}
          remainingSeconds={remainingSeconds}
          addSeconds={addSeconds}
        />
      </>
    )
  }

  return (
    <>
      <Confetti recycle={false} numberOfPieces={400} />
      <ConfirmationMarathonClient
        params={params}
        participant={{
          reference: participant.reference,
          deviceGroup: participant.deviceGroup,
          competitionClass: participant.competitionClass,
        }}
        images={images}
        submissionsCount={submissions.length}
        handleRedirect={handleRedirect}
        remainingSeconds={remainingSeconds}
        addSeconds={addSeconds}
      />
    </>
  )
}
