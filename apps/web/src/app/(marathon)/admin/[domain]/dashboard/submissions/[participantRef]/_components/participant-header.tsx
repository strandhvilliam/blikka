'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryStates } from 'nuqs'
import { Loader2, Trash2 } from 'lucide-react'
import { useTRPC } from '@/lib/trpc/client'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { useDomain } from '@/lib/domain-provider'
import { formatDomainPathname } from '@/lib/utils'
import { ParticipantIdentityCard } from './participant-identity-card'
import { ParticipantActionBanner } from './participant-action-banner'
import { ParticipantMetadata } from './participant-metadata'
import { ParticipantPipeline } from './participant-pipeline'
import { ParticipantVerifyDialog } from './participant-verify-dialog'
import {
  ParticipantContactEditDialog,
  type ParticipantWithPhoneNumber,
} from '../[submissionId]/_components/participant-contact-edit-dialog'
import { downloadRemoteUrl } from '../[submissionId]/_lib/download-remote-url'
import {
  PARTICIPANT_TAB,
  participantSearchParams,
} from '../_lib/participant-search-params'

function scrollToParticipantTabs() {
  document.getElementById('participant-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function ParticipantHeader({ participantRef }: { participantRef: string }) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const router = useRouter()

  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isEditContactOpen, setIsEditContactOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [, setParticipantQueryState] = useQueryStates(participantSearchParams, {
    history: 'push',
  })

  const { data: participant } = useSuspenseQuery(
    trpc.participants.getByReference.queryOptions({
      reference: participantRef,
      domain,
    }),
  )

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  )

  const runValidationsMutation = useMutation(trpc.validations.runValidations.mutationOptions())
  const generateContactSheetMutation = useMutation(
    trpc.contactSheets.generateContactSheet.mutationOptions(),
  )
  const generateParticipantZipMutation = useMutation(
    trpc.zipFiles.generateParticipantZip.mutationOptions(),
  )
  const deleteParticipantMutation = useMutation(trpc.participants.delete.mutationOptions())

  const handleRunValidations = () =>
    runValidationsMutation.mutate(
      { domain, reference: participantRef },
      {
        onSuccess: () => {
          toast.success('Validations completed successfully')
          queryClient.invalidateQueries({ queryKey: trpc.validations.pathKey() })
          queryClient.invalidateQueries({ queryKey: trpc.participants.pathKey() })
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to run validations')
        },
      },
    )

  const handleGenerateContactSheet = () =>
    generateContactSheetMutation.mutate(
      { domain, reference: participantRef },
      {
        onSuccess: () => {
          toast.success('Contact sheet generated successfully')
          queryClient.invalidateQueries({ queryKey: trpc.contactSheets.pathKey() })
          queryClient.invalidateQueries({ queryKey: trpc.participants.pathKey() })
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to generate contact sheet')
        },
      },
    )

  const handleGenerateZip = () =>
    generateParticipantZipMutation.mutate(
      { domain, reference: participantRef },
      {
        onSuccess: () => {
          toast.success('Zip file generated successfully')
          queryClient.invalidateQueries({ queryKey: trpc.zipFiles.pathKey() })
          queryClient.invalidateQueries({ queryKey: trpc.participants.pathKey() })
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to generate zip file')
        },
      },
    )

  const handleDeleteParticipant = () =>
    deleteParticipantMutation.mutate(
      { domain, reference: participantRef },
      {
        onSuccess: () => {
          toast.success('Participant deleted successfully')
          queryClient.invalidateQueries({ queryKey: trpc.participants.pathKey() })
          queryClient.invalidateQueries({ queryKey: trpc.zipFiles.pathKey() })
          router.push(formatDomainPathname('/admin/dashboard/submissions', domain))
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Failed to delete participant')
        },
      },
    )

  const downloadZipFile = async () => {
    const hasZip = (participant.zippedSubmissions?.length ?? 0) > 0
    if (!hasZip) {
      toast.info('No zip file available', {
        description: 'Generate a zip file from the pipeline below before downloading.',
      })
      return
    }

    try {
      setIsExporting(true)
      const { downloadUrl, filename } = await queryClient.fetchQuery(
        trpc.zipFiles.getParticipantZipDownloadUrl.queryOptions({
          domain,
          reference: participantRef,
        }),
      )
      await downloadRemoteUrl(downloadUrl, filename)
      toast.success('Zip file downloaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download zip file')
    } finally {
      setIsExporting(false)
    }
  }


  const handleViewValidationResults = () => {
    setParticipantQueryState({ tab: PARTICIPANT_TAB.VALIDATION })
    scrollToParticipantTabs()
  }

  const handleShowContactSheet = () => {
    setParticipantQueryState({ tab: PARTICIPANT_TAB.CONTACT_SHEET })
    scrollToParticipantTabs()
  }

  return (
    <div className="space-y-4">
      <ParticipantIdentityCard
        participant={participant}
        marathonMode={marathon?.mode ?? ''}
        onEditParticipant={() => setIsEditContactOpen(true)}
        onRunValidations={handleRunValidations}
        isRunningValidations={runValidationsMutation.isPending}
        onRegenerateContactSheet={handleGenerateContactSheet}
        isGeneratingContactSheet={generateContactSheetMutation.isPending}
        onDeleteParticipant={() => setIsDeleteDialogOpen(true)}
      />

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <ParticipantMetadata participant={participant} />
        <ParticipantPipeline
          embedded
          participant={participant}
          isRunningValidations={runValidationsMutation.isPending}
          onRunValidations={handleRunValidations}
          onViewValidationResults={handleViewValidationResults}
          isGeneratingContactSheet={generateContactSheetMutation.isPending}
          onGenerateContactSheet={handleGenerateContactSheet}
          onShowContactSheet={handleShowContactSheet}
          isGeneratingZip={generateParticipantZipMutation.isPending}
          onGenerateZip={handleGenerateZip}
          onDownloadZip={downloadZipFile}
          isDownloadingZip={isExporting}
        />
      </div>

      <ParticipantActionBanner
        participant={participant}
        onVerify={() => setIsVerifyDialogOpen(true)}
      />

      {marathon?.mode === 'marathon' ? (
        <ParticipantContactEditDialog
          participantRef={participantRef}
          participant={participant as ParticipantWithPhoneNumber}
          isOpen={isEditContactOpen}
          onOpenChange={setIsEditContactOpen}
          mode="marathon"
        />
      ) : null}

      <ParticipantVerifyDialog
        isOpen={isVerifyDialogOpen}
        onOpenChange={setIsVerifyDialogOpen}
        participant={participant}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete participant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete participant #{participant.reference} —{' '}
              {participant.firstname} {participant.lastname}? This action cannot be undone and will
              permanently delete all associated data including submissions, validations, and contact
              sheets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteParticipant}
              disabled={deleteParticipantMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteParticipantMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete participant
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
