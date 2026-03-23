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
    <div className="flex min-h-dvh flex-col pt-4">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-6">
        {/* Event branding */}
        <div className="flex flex-col items-center pb-10">
          {marathon.logoUrl ? (
            <div className="mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border shadow-sm">
              <img src={marathon.logoUrl} alt="Logo" width={96} height={96} />
            </div>
          ) : (
            <div className="mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
            </div>
          )}
          <h1 className="mt-2 text-center font-gothic text-2xl font-medium tracking-tight text-foreground">
            {marathon.name}
          </h1>
        </div>

        {/* Welcome card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 24 }}
          className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]"
        >
          <div className="p-6">
            <div className="mb-6 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                Welcome, {votingSession.firstName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ve been invited to vote on submissions
              </p>
            </div>

            <div className="rounded-xl bg-muted/30 p-4">
              <p className="text-center text-sm leading-relaxed text-muted-foreground">
                Use 1-5 stars as private review notes to shortlist photos for yourself. The stars do
                not count as your vote. When you know which photo you want to vote for, submit it as
                your final vote.
              </p>
            </div>

            {unavailableContent ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left">
                  <div className="flex items-center gap-2 text-amber-700">
                    <Clock className="h-4 w-4" />
                    <p className="text-sm font-semibold">{unavailableContent.title}</p>
                  </div>
                  <p className="mt-2 text-sm text-amber-800">{unavailableContent.description}</p>
                  <p className="mt-2 text-xs text-amber-700">{unavailableContent.hint}</p>
                </div>
                <PrimaryButton className="w-full rounded-full py-3 text-base" disabled>
                  Start Reviewing Photos
                  <PlayIcon className="h-4 w-4" />
                </PrimaryButton>
              </div>
            ) : (
              <Link href={`/live/${domain}/vote/${token}/viewer`} className="mt-6 block">
                <PrimaryButton className="w-full rounded-full py-3 text-base">
                  Start Reviewing Photos
                  <PlayIcon className="h-4 w-4" />
                </PrimaryButton>
              </Link>
            )}

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Voting as {votingSession.email}
            </p>
          </div>
        </motion.div>

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
