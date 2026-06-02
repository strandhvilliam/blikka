'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useTranslations } from 'next-intl'
import { useQuery } from '@tanstack/react-query'
import { RefreshCcw } from 'lucide-react'
import { notFound, useRouter } from 'next/navigation'
import {
  getParticipantRealtimeChannel,
  getRealtimeChannelEnvironmentFromNodeEnv,
  getRealtimeResultEventName,
} from '@blikka/realtime/contract'

import { cn, formatDomainPathname } from '@/lib/utils'
import { useDomain } from '@/lib/domain-provider'
import { useRealtime } from '@/lib/realtime-client'
import { parseUploadRealtimeEventData } from '@/lib/upload-status-realtime'
import { useTRPC } from '@/lib/trpc/client'
import { flowStateClientParamSerializer } from '@/lib/flow-state-params-client'
import { QrCodeGenerator } from '@/components/qr-code-generator'
import { PrimaryButton } from '@/components/ui/primary-button'
import { Spinner } from '@/components/ui/spinner'
import { useUploadFlowState } from '@/hooks/live/flow/use-upload-flow-state'
import {
  getFlaggedVerificationOutcome,
  VALIDATION_DECISION_TIMEOUT_MS,
  type MarathonVerificationMode,
} from '@/lib/flow/verification-routing'

interface VerificationClientProps {
  participantRef: string
  participantId?: number
  verificationMode: MarathonVerificationMode
}

const REALTIME_CHANNEL_ENV = getRealtimeChannelEnvironmentFromNodeEnv(
  typeof process !== 'undefined' ? process.env.NODE_ENV : undefined,
)
const PARTICIPANT_VERIFIED_EVENT = getRealtimeResultEventName('participant-verified')
const PARTICIPANT_VALIDATED_EVENT = getRealtimeResultEventName('participant-validated')
const VERIFICATION_EVENTS = [PARTICIPANT_VERIFIED_EVENT, PARTICIPANT_VALIDATED_EVENT] as const
const VERIFICATION_POLL_INTERVAL_MS = 60_000
const VALIDATION_DECISION_POLL_INTERVAL_MS = 2_000

const LIVE_QUERY_REFETCH_OPTIONS = {
  refetchOnMount: true,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
} as const

const VERIFICATION_TONE_STYLES = {
  orange: {
    pill: 'border-orange-200 bg-orange-50',
    ping: 'bg-orange-400',
    dot: 'bg-orange-500',
    label: 'text-orange-700',
    card: 'border-orange-200 shadow-[0_1px_3px_rgba(234,88,12,0.06),0_8px_24px_rgba(234,88,12,0.08)]',
  },
  amber: {
    pill: 'border-amber-200 bg-amber-50',
    ping: 'bg-amber-400',
    dot: 'bg-amber-500',
    label: 'text-amber-700',
    card: 'border-border shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]',
  },
} as const

export function VerificationClient({
  participantRef,
  participantId,
  verificationMode,
}: VerificationClientProps) {
  const router = useRouter()
  const domain = useDomain()
  const trpc = useTRPC()
  const t = useTranslations('VerificationPage')
  const { uploadFlowState } = useUploadFlowState()
  const [refreshTimeout, setRefreshTimeout] = useState(0)
  const [showQrCode, setShowQrCode] = useState(verificationMode === 'all')
  const [validationTimedOut, setValidationTimedOut] = useState(false)

  const confirmationHref = useMemo(() => {
    const serializedParams = flowStateClientParamSerializer(uploadFlowState)
    return formatDomainPathname(`/live/confirmation${serializedParams}`, domain)
  }, [domain, uploadFlowState])

  const participantChannel = useMemo(
    () => getParticipantRealtimeChannel(REALTIME_CHANNEL_ENV, domain, participantRef),
    [domain, participantRef],
  )
  const shouldCheckValidation = verificationMode === 'flagged' && !showQrCode

  const {
    data: participant,
    refetch: refetchParticipant,
    isLoading,
  } = useQuery(
    trpc.participants.getPublicParticipantByReference.queryOptions(
      {
        domain,
        reference: participantRef,
      },
      {
        enabled: !!participantRef,
        ...LIVE_QUERY_REFETCH_OPTIONS,
        refetchInterval: showQrCode ? VERIFICATION_POLL_INTERVAL_MS : false,
      },
    ),
  )

  const {
    data: validationStatus,
    refetch: refetchValidationStatus,
    isError: validationStatusIsError,
  } = useQuery(
    trpc.uploadFlow.getParticipantValidationStatus.queryOptions(
      {
        domain,
        reference: participantRef,
      },
      {
        enabled: shouldCheckValidation,
        ...LIVE_QUERY_REFETCH_OPTIONS,
        refetchInterval: shouldCheckValidation ? VALIDATION_DECISION_POLL_INTERVAL_MS : false,
        refetchIntervalInBackground: true,
      },
    ),
  )

  const handlersRef = useRef({
    confirmationHref,
    router,
    refetchValidationStatus,
    setShowQrCode,
  })

  useEffect(() => {
    handlersRef.current = {
      confirmationHref,
      router,
      refetchValidationStatus,
      setShowQrCode,
    }
  }, [confirmationHref, refetchValidationStatus, router])

  useEffect(() => {
    if (verificationMode === 'none') {
      router.replace(confirmationHref)
      return
    }

    if (participant?.status === 'verified') {
      router.replace(confirmationHref)
      return
    }

    if (!isLoading && !participant) {
      notFound()
    }
  }, [confirmationHref, isLoading, participant, router, verificationMode])

  useEffect(() => {
    if (!shouldCheckValidation) {
      return
    }

    const timeout = window.setTimeout(() => {
      setValidationTimedOut(true)
    }, VALIDATION_DECISION_TIMEOUT_MS)

    return () => window.clearTimeout(timeout)
  }, [shouldCheckValidation])

  useEffect(() => {
    if (!shouldCheckValidation) {
      return
    }

    const outcome = getFlaggedVerificationOutcome({
      decision: validationStatus?.participant?.validationDecision,
      timedOut: validationTimedOut,
      hasError: validationStatusIsError,
    })

    if (outcome === 'confirmation') {
      router.replace(confirmationHref)
      return
    }

    if (outcome === 'qr') {
      setShowQrCode(true)
    }
  }, [
    confirmationHref,
    router,
    shouldCheckValidation,
    validationStatus,
    validationStatusIsError,
    validationTimedOut,
  ])

  useRealtime({
    events: [...VERIFICATION_EVENTS],
    channels: participantChannel ? [participantChannel] : [],
    enabled: Boolean(domain) && Boolean(participantRef) && participantChannel.length > 0,
    onData: ({ event, data: rawData }) => {
      const data = parseUploadRealtimeEventData(rawData)
      if (!data) {
        return
      }

      if (event === PARTICIPANT_VERIFIED_EVENT) {
        if (data.outcome !== 'error') {
          handlersRef.current.router.replace(handlersRef.current.confirmationHref)
        }
        return
      }

      if (event === PARTICIPANT_VALIDATED_EVENT) {
        if (data.outcome === 'error') {
          handlersRef.current.setShowQrCode(true)
          return
        }

        void handlersRef.current.refetchValidationStatus()
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
    await refetchParticipant()
    setRefreshTimeout(5)
  }

  const qrCodeValue = `${domain}-${participantId ?? ''}-${participantRef}`

  if (shouldCheckValidation) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-white shadow-sm"
        >
          <Spinner className="h-7 w-7 text-foreground" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8 font-gothic text-3xl font-medium tracking-tight text-foreground"
        >
          {t('checkingSubmission')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground"
        >
          {t('checkingSubmissionDescription')}
        </motion.p>
      </div>
    )
  }

  const isFlaggedQrView = verificationMode === 'flagged'
  const toneStyles = VERIFICATION_TONE_STYLES[isFlaggedQrView ? 'orange' : 'amber']

  return (
    <div className="flex min-h-dvh flex-col items-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className={cn(
          'mb-10 flex items-center gap-2.5 rounded-full border px-4 py-2',
          toneStyles.pill,
        )}
      >
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              toneStyles.ping,
            )}
          />
          <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', toneStyles.dot)} />
        </span>
        <span className={cn('text-xs font-semibold uppercase tracking-wider', toneStyles.label)}>
          {isFlaggedQrView ? t('staffReviewNeeded') : t('waitingForVerification')}
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45 }}
        className="mb-10 text-center"
      >
        {isFlaggedQrView ? (
          <>
            <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              {t('manualVerificationHeading')}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t('manualVerificationDescription')}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground md:text-4xl">
              {t('almostThere')}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t('showQrCode')}
            </p>
          </>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.5, type: 'spring', stiffness: 200, damping: 24 }}
        className="w-full max-w-[320px]"
      >
        <div className={cn('overflow-hidden rounded-2xl border bg-white', toneStyles.card)}>
          <div className="flex flex-col items-center px-8 pt-8 pb-6">
            <QrCodeGenerator value={qrCodeValue} size={200} />
          </div>

          <div className="relative flex items-center px-6">
            <div className="absolute -left-3 h-6 w-6 rounded-full bg-white shadow-[inset_-1px_0_0_var(--border)]" />
            <div className="h-px w-full border-t border-dashed border-border" />
            <div className="absolute -right-3 h-6 w-6 rounded-full bg-white shadow-[inset_1px_0_0_var(--border)]" />
          </div>

          <div className="flex flex-col items-center px-8 pt-6 pb-8">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t('participant')}
            </span>
            <span className="mt-2 font-mono text-4xl font-bold tracking-widest text-foreground">
              {participantRef}
            </span>
          </div>
        </div>
      </motion.div>

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
          {refreshTimeout > 0 ? t('refreshAvailable', { seconds: refreshTimeout }) : t('refresh')}
        </PrimaryButton>
      </motion.div>
    </div>
  )
}
