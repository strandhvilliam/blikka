"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"
import { RefreshCcw } from "lucide-react"
import { notFound } from "next/navigation"

import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PrimaryButton } from "@/components/ui/primary-button"
import { cn, formatDomainPathname } from "@/lib/utils"
import { useDomain } from "@/lib/domain-provider"
import { useTRPC } from "@/lib/trpc/client"
import { flowStateClientParamSerializer } from "@/lib/flow-state-params-client"
import { QrCodeGenerator } from "./qr-code-generator"
import { useUploadFlowState } from "../(flow)/_hooks/use-upload-flow-state"

interface VerificationClientProps {
  participantRef: string
  participantId?: number
}

export function VerificationClient({ participantRef, participantId }: VerificationClientProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const t = useTranslations("VerificationPage")
  const { uploadFlowState } = useUploadFlowState()
  const [refreshTimeout, setRefreshTimeout] = useState(0)

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
        refetchInterval: 15000,
      },
    ),
  )

  useEffect(() => {
    if (participant?.status === "verified") {
      const serializedParams = flowStateClientParamSerializer(uploadFlowState)
      window.location.replace(formatDomainPathname(`/live/confirmation${serializedParams}`, domain))
    }

    if (!isLoading && !participant) notFound()
  }, [participant, isLoading, uploadFlowState, domain])

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
    <div className="flex flex-col items-center justify-center h-[100dvh] p-4 space-y-8">
      <CardHeader className="space-y-2 w-full">
        <CardTitle className="text-2xl font-rocgrotesk font-bold text-center">
          {t("almostThere")}
        </CardTitle>
        <CardDescription className="text-center">{t("showQrCode")}</CardDescription>
      </CardHeader>

      <div className="flex flex-col items-center space-y-4">
        <motion.div
          className="flex flex-col justify-center items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.2,
            delay: 0.2,
          }}
        >
          <div className="relative qr-perspective">
            <motion.div
              className="shadow-lg p-12 md:p-20 rounded-xl bg-white cursor-pointer relative qr-backface-hidden w-full max-w-xs md:max-w-lg lg:max-w-2xl min-h-[420px] md:min-h-[520px] flex flex-col items-center justify-center"
              animate={{
                rotateY: 0,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
              }}
              style={{
                transformStyle: "preserve-3d",
              }}
            >
              <QrCodeGenerator value={qrCodeValue} size={212} />
              {participantRef && (
                <div className="flex flex-col items-center mt-8">
                  <span className="text-xl md:text-2xl font-rocgrotesk font-semibold text-gray-700">
                    {t("participant")}
                  </span>
                  <span
                    className="font-mono font-bold text-4xl md:text-5xl text-gray-900 select-all tracking-wider mt-2"
                    style={{
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    }}
                  >
                    {participantRef}
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>
      </div>

      <PrimaryButton
        className="mt-4 py-3 w-full max-w-xs md:max-w-lg lg:max-w-2xl"
        onClick={handleRefresh}
        disabled={refreshTimeout > 0}
      >
        <RefreshCcw className={cn("h-4 w-4")} />
        {refreshTimeout > 0 ? t("refreshAvailable", { seconds: refreshTimeout }) : t("refresh")}
      </PrimaryButton>
    </div>
  )
}
