'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { getJuryEntryLink } from '@/lib/jury/jury-utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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

export function JuryInvitationRegenerateDialog({
  invitationId,
  open,
  onOpenChange,
}: {
  invitationId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [resendEmail, setResendEmail] = useState(true)
  const trpc = useTRPC()
  const domain = useDomain()
  const queryClient = useQueryClient()

  function invalidateInvitationQueries() {
    void queryClient.invalidateQueries({
      queryKey: trpc.jury.getJuryInvitationById.queryKey({ id: invitationId }),
    })
    void queryClient.invalidateQueries({
      queryKey: trpc.jury.getJuryInvitationsByDomain.queryKey({ domain }),
    })
  }

  const { mutate: regenerateToken, isPending: isRegenerating } = useMutation(
    trpc.jury.regenerateJuryInvitationToken.mutationOptions({
      onSuccess: (invitation) => {
        navigator.clipboard.writeText(getJuryEntryLink(domain, invitation.token))
        toast.success('New link generated and copied to clipboard')

        if (resendEmail) {
          resendEmailMutation({ id: invitationId, domain })
        } else {
          onOpenChange(false)
          invalidateInvitationQueries()
        }
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to regenerate link')
      },
    }),
  )

  const { mutate: resendEmailMutation, isPending: isResending } = useMutation(
    trpc.jury.resendJuryInvitationEmail.mutationOptions({
      onSuccess: () => {
        toast.success('Invite email sent with the new link')
        onOpenChange(false)
        invalidateInvitationQueries()
      },
      onError: (error) => {
        toast.warning('Link regenerated, but email could not be sent', {
          description: error.message,
        })
        onOpenChange(false)
        invalidateInvitationQueries()
      },
    }),
  )

  const isPending = isRegenerating || isResending

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Regenerate review link?</AlertDialogTitle>
          <AlertDialogDescription>
            The current link will stop working immediately. A new link will be generated and copied
            to your clipboard.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 py-2">
          <Checkbox
            id="resend-after-regen"
            checked={resendEmail}
            onCheckedChange={(checked) => setResendEmail(checked === true)}
          />
          <Label htmlFor="resend-after-regen" className="text-sm font-normal">
            Resend invite email with the new link
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            className={cn(isPending && 'pointer-events-none opacity-70')}
            onClick={(e) => {
              e.preventDefault()
              regenerateToken({ id: invitationId, domain })
            }}
          >
            {isPending ? 'Working…' : 'Regenerate link'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
