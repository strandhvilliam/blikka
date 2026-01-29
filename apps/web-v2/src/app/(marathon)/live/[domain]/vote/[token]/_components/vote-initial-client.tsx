"use client";

import { motion } from "motion/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { PrimaryButton } from "@/components/ui/primary-button";
import { ImageIcon, PlayIcon } from "lucide-react";
import Image from "next/image";

export function VoteInitialClient({
  domain,
  token,
}: {
  domain: string;
  token: string;
}) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.voting.getVotingSession.queryOptions({ domain, token }),
  );

  const { votingSession, marathon } = data;

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
                You've been invited to vote on submissions
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                Use 1-5 stars to filter and organize photos (like Lightroom).
                Then select your single favorite to cast your vote.
              </p>
            </div>

            <PrimaryButton
              onClick={() => {
                window.location.href = `/live/${domain}/vote/${token}/submissions`;
              }}
              className="w-full py-3 text-base text-white rounded-full"
            >
              Start Voting
              <PlayIcon className="h-4 w-4" />
            </PrimaryButton>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Voting as {votingSession.email}
            </p>
          </motion.div>

          <div className="mt-6 flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-1 italic">
              Powered by
            </p>
            <div className="flex items-center gap-1.5">
              <Image
                src="/blikka-logo.svg"
                alt="Blikka"
                width={20}
                height={17}
              />
              <span className="font-rocgrotesk font-bold text-base tracking-tight">
                blikka
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
