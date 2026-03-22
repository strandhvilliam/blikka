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
import { getVotingUnavailableContent } from "../_lib/voting-unavailable"

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
    <div className="flex flex-col min-h-dvh relative overflow-hidden pt-4">
      <div className="z-20 flex flex-col flex-1 h-full">
        <main className="flex-1 px-6 pb-6 max-w-md mx-auto w-full flex flex-col justify-center">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 border border-border shadow-xl">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                <Clock className="w-10 h-10 text-amber-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-center mb-2">{content.title}</h1>
            <p className="text-muted-foreground text-center mb-6">{content.description}</p>
            <div className="bg-muted rounded-xl p-4 mb-6">
              <p className="text-sm text-muted-foreground text-center">{content.hint}</p>
            </div>
            <div className="flex justify-center">
              <Button onClick={handleGoToLanding} variant="outline" className="w-full">
                Go to home page
              </Button>
            </div>
          </div>

          {/* Powered by Blikka */}
          <div className="mt-6 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-1 italic">Powered by</p>
            <div className="flex items-center gap-1.5">
              <Image src="/blikka-logo.svg" alt="Blikka" width={20} height={17} />
              <span className="font-rocgrotesk font-bold text-base tracking-tight">blikka</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
