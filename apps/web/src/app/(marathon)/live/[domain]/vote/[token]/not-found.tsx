"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { useRouter, useParams } from "next/navigation"

export default function NotFound() {
  const router = useRouter()
  const params = useParams()
  const domain = params?.domain as string

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
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-50">
                <AlertTriangle className="h-7 w-7 text-orange-600" />
              </div>
            </div>
            <h1 className="text-center font-gothic text-2xl font-medium tracking-tight text-foreground">
              Voting Session Not Found
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              The voting session you&apos;re looking for doesn&apos;t exist or is no longer
              available.
            </p>
            <div className="mt-6 rounded-xl bg-muted/30 p-4">
              <p className="text-center text-sm text-muted-foreground">
                This could happen if the voting link is incorrect, the session has expired, or the
                voting period has ended.
              </p>
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
