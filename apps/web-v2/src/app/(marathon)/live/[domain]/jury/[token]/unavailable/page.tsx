"use client"

import { Clock, ShieldAlert } from "lucide-react"
import Image from "next/image"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function JuryUnavailablePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const domain = params?.domain as string
  const reason = searchParams.get("reason")

  const isExpired = reason === "expired"
  const isUnsupportedMode = reason === "unsupported-mode"

  const title = isExpired
    ? "Invitation expired"
    : isUnsupportedMode
      ? "Jury review unavailable"
      : "Review is not available"

  const description = isExpired
    ? "This jury invitation has expired and can no longer be used."
    : isUnsupportedMode
      ? "This marathon is not running in jury review mode."
      : "This review link is not available right now."

  const hint = isExpired
    ? "Ask the organizer to send a new invitation if you still need access."
    : isUnsupportedMode
      ? "Only marathons running in marathon mode can use the jury reviewer flow."
      : "If this seems wrong, contact the organizer who sent the link."

  return (
    <div className="flex flex-col min-h-dvh relative overflow-hidden pt-4">
      <div className="z-20 flex flex-col flex-1 h-full">
        <main className="flex-1 px-6 pb-6 max-w-md mx-auto w-full flex flex-col justify-center">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 border border-border shadow-xl">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                {isUnsupportedMode ? (
                  <ShieldAlert className="w-10 h-10 text-amber-600" />
                ) : (
                  <Clock className="w-10 h-10 text-amber-600" />
                )}
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
              <Button onClick={() => router.push(domain ? `/live/${domain}` : "/")} variant="outline" className="w-full">
                Go to home page
              </Button>
            </div>
          </div>

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
