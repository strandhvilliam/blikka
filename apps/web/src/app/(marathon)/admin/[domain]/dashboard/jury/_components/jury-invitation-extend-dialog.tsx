'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTRPC } from '@/lib/trpc/client'
import { useDomain } from '@/lib/domain-provider'
import { getEndOfDayExpiryIso } from '../_lib/invitation-expiry'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PrimaryButton } from '@/components/ui/primary-button'

export function JuryInvitationExtendDialog({
  invitationId,
  open,
  onOpenChange,
}: {
  invitationId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [daysToAdd, setDaysToAdd] = useState(7)
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

  const { mutate: extendExpiry, isPending } = useMutation(
    trpc.jury.extendJuryInvitationExpiry.mutationOptions({
      onSuccess: () => {
        toast.success('Invitation expiry updated')
        onOpenChange(false)
        invalidateInvitationQueries()
      },
      onError: (error) => {
        toast.error(error.message || 'Failed to extend expiry')
      },
    }),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    extendExpiry({
      id: invitationId,
      expiresAt: getEndOfDayExpiryIso(daysToAdd),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Extend expiry</DialogTitle>
          <DialogDescription>
            Set a new expiry date for this invitation. The link will work again until that date (max
            90 days from today).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-2 py-2">
            <Label htmlFor="extend-days">Add days from today</Label>
            <Input
              id="extend-days"
              type="number"
              min={1}
              max={90}
              value={daysToAdd}
              onChange={(e) => setDaysToAdd(Number(e.target.value))}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <PrimaryButton type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Extend expiry'}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
