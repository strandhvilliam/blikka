"use client";

import { motion } from "motion/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { PrimaryButton } from "@/components/ui/primary-button";

export function VoteWelcomeClient({
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-lg w-full"
      >
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Marathon Logo / Header */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-center">
            {marathon.logoUrl ? (
              <img
                src={marathon.logoUrl}
                alt={marathon.name}
                className="h-16 mx-auto mb-4 object-contain"
              />
            ) : (
              <div className="h-16 w-16 mx-auto mb-4 bg-white/10 rounded-xl flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            )}
            <h1 className="text-2xl font-bold text-white">{marathon.name}</h1>
          </div>

          {/* Welcome Content */}
          <div className="p-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Welcome, {votingSession.firstName} {votingSession.lastName}!
              </h2>
              <p className="text-gray-600 mb-6">
                You have been invited to vote on a submission for this photo
                marathon.
              </p>
            </motion.div>

            {/* Instructions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="space-y-4 mb-8"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-orange-600 font-semibold text-sm">
                    1
                  </span>
                </div>
                <div>
                  <p className="text-gray-800 font-medium">
                    Review the submission
                  </p>
                  <p className="text-gray-500 text-sm">
                    Take your time to carefully examine the photograph
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-orange-600 font-semibold text-sm">
                    2
                  </span>
                </div>
                <div>
                  <p className="text-gray-800 font-medium">Cast your vote</p>
                  <p className="text-gray-500 text-sm">
                    Rate the submission based on the judging criteria
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-orange-600 font-semibold text-sm">
                    3
                  </span>
                </div>
                <div>
                  <p className="text-gray-800 font-medium">
                    Submit your rating
                  </p>
                  <p className="text-gray-500 text-sm">
                    Once submitted, your vote will be recorded
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Action Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <PrimaryButton
                className="w-full py-4 text-lg"
                onClick={() => {
                  window.location.href = `/live/${domain}/vote/${token}/submissions`;
                }}
              >
                Start Voting
                <svg
                  className="w-5 h-5 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </PrimaryButton>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-center text-gray-400 text-sm mt-6"
        >
          Voting as {votingSession.email}
        </motion.p>
      </motion.div>
    </div>
  );
}
