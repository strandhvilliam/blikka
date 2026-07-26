'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Input } from '@/components/ui/input'
import { PrimaryButton } from '@/components/ui/primary-button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { useUploadFlowState } from '@/hooks/live/flow/use-upload-flow-state'
import { useStepState } from '@/lib/flow/step-state-context'
import {
  resolveParticipantNumberDialogKind,
  type ParticipantExistenceStatus,
  type ParticipantNumberDialogKind,
} from '@/lib/flow-helpers'

/**
 * Copy for each duplicate-number dialog. Every kind offers a way forward — the replace
 * variants warn about what gets overwritten, the rest just confirm continuing.
 */
const DIALOG_COPY = {
  'replace-upload': {
    title: 'titleReplace',
    description: 'descriptionReplace',
    cancel: 'cancel',
    confirm: 'confirmReplace',
  },
  'replace-prepared-upload': {
    title: 'titleReplacePrepared',
    description: 'descriptionReplacePrepared',
    cancel: 'cancel',
    confirm: 'confirmReplacePrepared',
  },
  'replace-in-progress': {
    title: 'titleReplaceInProgress',
    description: 'descriptionReplaceInProgress',
    cancel: 'cancel',
    confirm: 'confirmReplacePrepared',
  },
  'continue-prepared': {
    title: 'titlePrepared',
    description: 'descriptionPrepared',
    cancel: 'cancelPrepared',
    confirm: 'confirmPrepared',
  },
  'update-registration': {
    title: 'title',
    description: 'description',
    cancel: 'cancel',
    confirm: 'confirm',
  },
  'continue-existing': {
    title: 'titleExists',
    description: 'descriptionExists',
    cancel: 'cancelPrepared',
    confirm: 'confirmPrepared',
  },
} as const satisfies Record<
  ParticipantNumberDialogKind,
  Record<'title' | 'description' | 'cancel' | 'confirm', string>
>

const dialogCopyKey = (
  kind: ParticipantNumberDialogKind,
  slot: 'title' | 'description' | 'cancel' | 'confirm',
) => `participantNumber.confirmDialog.${DIALOG_COPY[kind][slot]}`

const createInitializeParticipantSchema = (t: ReturnType<typeof useTranslations>) =>
  z.object({
    participantRef: z
      .string()
      .refine((val) => /^\d{1,4}$/.test(val), t('participantNumber.required')),
    domain: z.string().min(1, 'Invalid domain'),
  })

const createParticipantValidator =
  (t: ReturnType<typeof useTranslations>) =>
  ({ value }: { value: { participantRef: string; domain: string } }) => {
    const result = createInitializeParticipantSchema(t).safeParse(value)
    if (result.success) return undefined
    const fieldErrors = result.error.flatten().fieldErrors
    return {
      fields: {
        participantRef: fieldErrors.participantRef?.[0],
        domain: fieldErrors.domain?.[0],
      },
    }
  }

export function ParticipantNumberStep() {
  const { uploadFlowState, setUploadFlowState } = useUploadFlowState()
  const { handleNextStep, flowVariant } = useStepState()
  const domain = useDomain()
  const t = useTranslations('FlowPage')
  const trpc = useTRPC()

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [pendingRef, setPendingRef] = useState('')
  const [existingParticipantStatus, setExistingParticipantStatus] =
    useState<ParticipantExistenceStatus>(null)
  const [isCheckingParticipant, setIsCheckingParticipant] = useState(false)
  const isCheckingParticipantRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const checkParticipantExists = useMutation(
    trpc.uploadFlow.checkParticipantExists.mutationOptions(),
  )
  const isParticipantLookupPending = isCheckingParticipant || checkParticipantExists.isPending

  const form = useForm({
    defaultValues: {
      participantRef: uploadFlowState.participantRef ?? '',
      domain,
    },
    onSubmit: async ({ value }) => {
      if (isCheckingParticipantRef.current) return

      const paddedRef = value.participantRef.padStart(4, '0')
      setPendingRef(paddedRef)
      isCheckingParticipantRef.current = true
      setIsCheckingParticipant(true)

      try {
        const participantCheck = await checkParticipantExists.mutateAsync({
          domain,
          reference: paddedRef,
        })

        // A number that is already taken is never a dead end. Every reused number lands in
        // the confirm dialog, which spells out what gets replaced and lets the participant
        // continue without finding crew. Uploaded photos are kept in storage either way, so
        // a wrong number can be untangled afterwards.
        if (participantCheck.exists) {
          setExistingParticipantStatus(participantCheck.status as ParticipantExistenceStatus)
          setConfirmDialogOpen(true)
        } else {
          setExistingParticipantStatus(null)
          setUploadFlowState((prev) => ({
            ...prev,
            participantRef: paddedRef,
            replaceCompletedParticipantUpload: null,
          }))
          handleNextStep()
        }
      } catch (error) {
        console.error(error)
        toast.error(t('participantNumber.error'))
      } finally {
        isCheckingParticipantRef.current = false
        if (isMountedRef.current) {
          setIsCheckingParticipant(false)
        }
      }
    },
    validators: {
      onChange: createParticipantValidator(t),
      onBlur: createParticipantValidator(t),
    },
  })

  const confirmDialogKind = resolveParticipantNumberDialogKind({
    flowVariant,
    status: existingParticipantStatus,
  })
  // Warning variants replace someone's existing work, so they get the louder layout and
  // have to send the explicit opt-in flag to the server.
  const isReplaceWarning =
    confirmDialogKind === 'replace-upload' ||
    confirmDialogKind === 'replace-prepared-upload' ||
    confirmDialogKind === 'replace-in-progress'

  const handleConfirm = () => {
    setUploadFlowState((prev) => ({
      ...prev,
      participantRef: pendingRef,
      replaceCompletedParticipantUpload: isReplaceWarning ? true : null,
    }))
    setConfirmDialogOpen(false)
    handleNextStep()
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-6">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="font-gothic text-3xl font-medium tracking-tight text-foreground">
          {t('participantNumber.title')}
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
          {existingParticipantStatus === 'prepared' && flowVariant === 'upload'
            ? t('participantNumber.descriptionPrepared')
            : existingParticipantStatus
              ? t('participantNumber.descriptionAlreadyExists')
              : t('participantNumber.description')}
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
        noValidate
        className="space-y-8"
      >
        <div>
          <form.Field name="participantRef">
            {(field) => {
              const hasError = field.state.meta.isTouched && field.state.meta.errors.length > 0

              return (
                <>
                  <Input
                    id={field.name}
                    name={field.name}
                    aria-label={t('participantNumber.title')}
                    type="text"
                    inputMode="numeric"
                    placeholder="0000"
                    autoComplete="off"
                    enterKeyHint="done"
                    pattern="[0-9]*"
                    className={`h-16 rounded-xl border-2 bg-white text-center font-mono text-4xl tracking-[0.3em] leading-none transition-colors ${
                      hasError
                        ? 'border-destructive focus-visible:ring-destructive'
                        : 'border-border focus-visible:border-foreground'
                    }`}
                    aria-invalid={hasError}
                    aria-describedby={hasError ? `${field.name}-error` : undefined}
                    autoFocus
                    maxLength={4}
                    disabled={isParticipantLookupPending}
                    value={field.state.value}
                    onChange={(e) => {
                      const numericValue = e.target.value.replace(/\D/g, '').slice(0, 4)
                      field.handleChange(numericValue)
                    }}
                    onBlur={() => {
                      if (field.state.value && field.state.value.length > 0) {
                        field.handleChange(field.state.value.padStart(4, '0'))
                      }
                      field.handleBlur()
                    }}
                  />
                  {hasError && (
                    <p
                      id={`${field.name}-error`}
                      className="mt-3 text-center text-sm font-medium text-destructive"
                    >
                      {field.state.meta.errors[0]}
                    </p>
                  )}
                </>
              )
            }}
          </form.Field>
        </div>

        <form.Subscribe
          selector={(state: { isSubmitting: boolean }) => ({
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ isSubmitting }) => (
            <PrimaryButton
              type="submit"
              className="w-full rounded-full py-3.5 text-base"
              disabled={isSubmitting || isParticipantLookupPending}
            >
              {isParticipantLookupPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  <span>{t('participantNumber.checking')}</span>
                </>
              ) : (
                <>
                  <span>{t('participantNumber.continue')}</span>
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </PrimaryButton>
          )}
        </form.Subscribe>
      </form>

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(dialogCopyKey(confirmDialogKind, 'title'))}</AlertDialogTitle>
            <AlertDialogDescription
              className={isReplaceWarning ? 'text-base leading-relaxed' : undefined}
            >
              {isReplaceWarning
                ? t.rich(dialogCopyKey(confirmDialogKind, 'description'), {
                    ref: pendingRef,
                    number: (chunks) => (
                      <span className="font-gothic font-medium text-foreground">{chunks}</span>
                    ),
                  })
                : t(dialogCopyKey(confirmDialogKind, 'description'), { ref: pendingRef })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isReplaceWarning ? 'flex-row gap-3' : undefined}>
            <AlertDialogCancel
              className={isReplaceWarning ? 'mt-0 h-12 flex-1 rounded-full' : undefined}
            >
              {t(dialogCopyKey(confirmDialogKind, 'cancel'))}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                isReplaceWarning
                  ? 'h-12 flex-1 rounded-full bg-brand-primary text-white hover:bg-brand-primary hover:opacity-90'
                  : undefined
              }
            >
              {t(dialogCopyKey(confirmDialogKind, 'confirm'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
