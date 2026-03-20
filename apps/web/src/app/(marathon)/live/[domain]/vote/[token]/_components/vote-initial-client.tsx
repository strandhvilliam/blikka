"use client"

import { motion } from "motion/react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Clock, ImageIcon, PlayIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { getVotingUnavailableReason } from "@/lib/voting-lifecycle"
import { getVotingUnavailableContent } from "../_lib/voting-unavailable"

export function VoteInitialClient({ domain, token }: { domain: string; token: string }) {
  const trpc = useTRPC()
  const { data: votingSession } = useSuspenseQuery(
    trpc.voting.getVotingSession.queryOptions({ token }),
  )

  const { data: marathon } = useSuspenseQuery(
    trpc.uploadFlow.getPublicMarathon.queryOptions({ domain }),
  )

  const unavailableReason = getVotingUnavailableReason({
    startsAt: votingSession.startsAt,
    endsAt: votingSession.endsAt,
  })
  const unavailableContent = unavailableReason
    ? getVotingUnavailableContent(unavailableReason)
    : null

  return (
    <div className="flex flex-col min-h-dvh relative overflow-hidden pt-4">
      <div className="z-20 flex flex-col flex-1 h-full">
        <main className="flex-1 px-6 pb-6 max-w-md mx-auto w-full flex flex-col justify-center">
          <div className="flex flex-col items-center pb-12">
            {marathon.logoUrl ? (
              <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3 overflow-hidden shadow border">
                <img src={marathon.logoUrl} alt="Logo" width={96} height={96} />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center bg-gray-200">
                <ImageIcon className="w-12 h-12" />
              </div>
            )}
            <h1 className="text-2xl font-rocgrotesk font-extrabold text-gray-900 text-center mt-2">
              {marathon.name}
            </h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 border border-border shadow-xl"
          >
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Welcome, {votingSession.firstName}
              </h2>
              <p className="text-sm text-gray-500">
                You&apos;ve been invited to vote on submissions
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                Use 1-5 stars as private review notes to shortlist photos for yourself. The stars do
                not count as your vote. When you have picked one winner, submit that photo as your
                final vote.
              </p>
            </div>

            {unavailableContent ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-left">
                  <div className="flex items-center gap-2 text-amber-700">
                    <Clock className="h-4 w-4" />
                    <p className="text-sm font-semibold">{unavailableContent.title}</p>
                  </div>
                  <p className="mt-2 text-sm text-amber-800">{unavailableContent.description}</p>
                  <p className="mt-2 text-xs text-amber-700">{unavailableContent.hint}</p>
                </div>
                <PrimaryButton className="w-full py-3 text-base text-white rounded-full" disabled>
                  Start Reviewing Photos
                  <PlayIcon className="h-4 w-4" />
                </PrimaryButton>
              </div>
            ) : (
              <Link href={`/live/${domain}/vote/${token}/viewer`}>
                <PrimaryButton className="w-full py-3 text-base text-white rounded-full">
                  Start Reviewing Photos
                  <PlayIcon className="h-4 w-4" />
                </PrimaryButton>
              </Link>
            )}

            <p className="text-center text-xs text-muted-foreground mt-4">
              Voting as {votingSession.email}
            </p>
          </motion.div>

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
