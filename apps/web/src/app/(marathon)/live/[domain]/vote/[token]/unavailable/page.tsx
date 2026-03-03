"use client"

import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useRouter, useParams, useSearchParams } from "next/navigation"

export default function UnavailablePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const domain = params?.domain as string
  const reason = searchParams.get("reason")

  const isNotStarted = reason === "not-started"
  const isEnded = reason === "ended"

  const handleGoToLanding = () => {
    if (domain) {
      router.push(`/live/${domain}`)
    } else {
      router.push("/")
    }
  }

  const title = isNotStarted
    ? "Voting Has Not Started Yet"
    : isEnded
      ? "Voting Has Ended"
      : "Voting Is Not Available"

  const description = isNotStarted
    ? "The voting period for this session hasn't started yet. Please check back later."
    : isEnded
      ? "The voting period for this session has ended. Thank you for your interest."
      : "Voting is not available at this time."

  const hint = isNotStarted
    ? "You'll be able to vote once the voting window opens. Make sure to save this link for when voting begins."
    : isEnded
      ? "The voting window has closed. Results may be available on the event page."
      : "This could happen if the voting link is incorrect or the voting period has not been set."

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
            <h1 className="text-2xl font-bold text-center mb-2">{title}</h1>
            <p className="text-muted-foreground text-center mb-6">
              {description}
            </p>
            <div className="bg-muted rounded-xl p-4 mb-6">
              <p className="text-sm text-muted-foreground text-center">
                {hint}
              </p>
            </div>
            <div className="flex justify-center">
              <Button
                onClick={handleGoToLanding}
                variant="outline"
                className="w-full"
              >
                Go to home page
              </Button>
            </div>
          </div>

          {/* Powered by Blikka */}
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
  )
}
