"use client"

import { useEffect } from "react"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { getVotingUnavailableReason } from "@/lib/voting-lifecycle"
import { formatDomainPathname } from "@/lib/utils"
import { getVotingUnavailableContent } from "@/lib/vote/voting-unavailable"

export default function UnavailablePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const trpc = useTRPC()
  const domain = params?.domain as string | undefined
  const token = params?.token as string | undefined
  const reason = searchParams.get("reason")
  const content = getVotingUnavailableContent(reason)

  const { data: votingSession } = useQuery({
    ...trpc.voting.getVotingSession.queryOptions({ token: token ?? "" }),
    enabled: Boolean(token),
    refetchOnWindowFocus: true,
  })

  useEffect(() => {
    if (!votingSession || !token) return

    const sessionDomain = votingSession.marathon?.domain
    const pathDomain = sessionDomain && domain && sessionDomain !== domain ? sessionDomain : domain
    if (!pathDomain) return

    if (votingSession.voteSubmissionId && votingSession.votedAt) {
      router.replace(formatDomainPathname(`/live/vote/${token}/completed`, pathDomain, "live"))
      return
    }

    const unavailableReason = getVotingUnavailableReason({
      startsAt: votingSession.startsAt,
      endsAt: votingSession.endsAt,
    })

    if (!unavailableReason) {
      router.replace(formatDomainPathname(`/live/vote/${token}`, pathDomain, "live"))
    }
  }, [votingSession, domain, token, router])

  const handleGoToLanding = () => {
    if (domain) {
      router.push(`/live/${domain}`)
    } else {
      router.push("/")
    }
  }

  return (
    <div className="flex min-h-dvh flex-col pt-4">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="p-6">
            <div className="mb-6 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
                <Clock className="h-7 w-7 text-amber-600" />
              </div>
            </div>
            <h1 className="text-center font-gothic text-2xl font-medium tracking-tight text-foreground">
              {content.title}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">{content.description}</p>
            <div className="mt-6 rounded-xl bg-muted/30 p-4">
              <p className="text-center text-sm text-muted-foreground">{content.hint}</p>
            </div>
            <div className="mt-6">
              <Button
                onClick={handleGoToLanding}
                variant="outline"
                className="w-full rounded-full"
              >
                Go to home page
              </Button>
            </div>
          </div>
        </div>

        {/* Powered by */}
        <div className="mt-6 flex flex-col items-center">
          <p className="mb-1 text-xs italic text-muted-foreground">Powered by</p>
          <div className="flex items-center gap-1.5">
            <Image src="/blikka-logo.svg" alt="Blikka" width={20} height={17} />
            <span className="font-special-gothic text-base tracking-tight">blikka</span>
          </div>
        </div>
      </main>
    </div>
  )
}
