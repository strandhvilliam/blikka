"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"
import { RefreshCcw } from "lucide-react"
import { notFound, useRouter } from "next/navigation"
import {
  getParticipantRealtimeChannel,
  getRealtimeChannelEnvironmentFromNodeEnv,
  getRealtimeResultEventName,
} from "@blikka/realtime/contract"
import { z } from "zod"

import { formatDomainPathname } from "@/lib/utils"
import { useDomain } from "@/lib/domain-provider"
import { useRealtime } from "@/lib/realtime-client"
import { useTRPC } from "@/lib/trpc/client"
import { flowStateClientParamSerializer } from "@/lib/flow-state-params-client"
import { QrCodeGenerator } from "@/components/qr-code-generator"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useUploadFlowState } from "../(flow)/_hooks/use-upload-flow-state"

interface VerificationClientProps {
  participantRef: string
  participantId?: number
}

const realtimeVerificationPayloadSchema = z
  .object({
    outcome: z.enum(["success", "error"]).optional(),
    reference: z.string().nullish(),
  })
  .loose()

const REALTIME_CHANNEL_ENV = getRealtimeChannelEnvironmentFromNodeEnv(
  typeof process !== "undefined" ? process.env.NODE_ENV : undefined,
)
const PARTICIPANT_VERIFIED_EVENT = getRealtimeResultEventName("participant-verified")
const VERIFICATION_POLL_INTERVAL_MS = 60_000

function parseRealtimeVerificationPayload(rawData: unknown) {
  if (typeof rawData === "string") {
    try {
      return realtimeVerificationPayloadSchema.safeParse(JSON.parse(rawData))
    } catch {
      return realtimeVerificationPayloadSchema.safeParse(null)
    }
  }

  return realtimeVerificationPayloadSchema.safeParse(rawData)
}

export function VerificationClient({ participantRef, participantId }: VerificationClientProps) {
  const router = useRouter()
  const domain = useDomain()
  const trpc = useTRPC()
  const t = useTranslations("VerificationPage")
  const { uploadFlowState } = useUploadFlowState()
  const [refreshTimeout, setRefreshTimeout] = useState(0)
  const confirmationHref = useMemo(() => {
    const serializedParams = flowStateClientParamSerializer(uploadFlowState)
    return formatDomainPathname(`/live/confirmation${serializedParams}`, domain)
  }, [domain, uploadFlowState])
  const confirmationHrefRef = useRef(confirmationHref)
  const participantChannel = useMemo(
    () => getParticipantRealtimeChannel(REALTIME_CHANNEL_ENV, domain, participantRef),
    [domain, participantRef],
  )

  useEffect(() => {
    confirmationHrefRef.current = confirmationHref
  }, [confirmationHref])

  const {
    data: participant,
    refetch,
    isLoading,
  } = useQuery(
    trpc.participants.getPublicParticipantByReference.queryOptions(
      {
        domain,
        reference: participantRef,
      },
      {
        enabled: !!participantRef,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchInterval: VERIFICATION_POLL_INTERVAL_MS,
      },
    ),
  )

  useEffect(() => {
    if (participant?.status === "verified") {
      router.replace(confirmationHref)
    }

    if (!isLoading && !participant) notFound()
  }, [confirmationHref, isLoading, participant, router])

  useRealtime({
    events: [PARTICIPANT_VERIFIED_EVENT],
    channels: participantChannel ? [participantChannel] : [],
    enabled: Boolean(domain) && Boolean(participantRef) && participantChannel.length > 0,
    onData: ({ data: rawData }) => {
      try {
        const parsed = parseRealtimeVerificationPayload(rawData)

        if (!parsed.success || parsed.data.outcome === "error") {
          return
        }

        router.replace(confirmationHrefRef.current)
      } catch {
        // Ignore realtime transport or payload issues and rely on polling as fallback.
      }
    },
  })

  useEffect(() => {
    if (refreshTimeout <= 0) return

    const timer = setTimeout(() => {
      setRefreshTimeout((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => clearTimeout(timer)
  }, [refreshTimeout])

  const handleRefresh = async () => {
    await refetch()
    setRefreshTimeout(5)
  }

  const qrCodeValue = `${domain}-${participantId ?? ""}-${participantRef}`

  return (
    <div className="flex min-h-dvh flex-col items-center px-6 py-10">
      {/* Top status pill */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="mb-10 flex items-center gap-2.5 rounded-full border border-amber-200 bg-amber-50 px-4 py-2"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          {t("waitingForVerification")}
        </span>
      </motion.div>

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45 }}
        className="mb-10 text-center"
      >
        <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          {t("almostThere")}
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {t("showQrCode")}
        </p>
      </motion.div>

      {/* Credential card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.5, type: "spring", stiffness: 200, damping: 24 }}
        className="w-full max-w-[320px]"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]">
          {/* QR area */}
          <div className="flex flex-col items-center px-8 pt-8 pb-6">
            <QrCodeGenerator value={qrCodeValue} size={200} />
          </div>

          {/* Divider with notch cutouts */}
          <div className="relative flex items-center px-6">
            <div className="absolute -left-3 h-6 w-6 rounded-full bg-white shadow-[inset_-1px_0_0_var(--border)]" />
            <div className="h-px w-full border-t border-dashed border-border" />
            <div className="absolute -right-3 h-6 w-6 rounded-full bg-white shadow-[inset_1px_0_0_var(--border)]" />
          </div>

          {/* Participant info */}
          <div className="flex flex-col items-center px-8 pt-6 pb-8">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("participant")}
            </span>
            <span className="mt-2 font-mono text-4xl font-bold tracking-widest text-foreground">
              {participantRef}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Refresh button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="mt-8 w-full max-w-[320px]"
      >
        <PrimaryButton
          className="w-full py-3.5 rounded-xl"
          onClick={handleRefresh}
          disabled={refreshTimeout > 0}
        >
          <RefreshCcw className="h-4 w-4" />
          {refreshTimeout > 0 ? t("refreshAvailable", { seconds: refreshTimeout }) : t("refresh")}
        </PrimaryButton>
      </motion.div>
    </div>
  )
}
