"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PrimaryButton } from "@/components/ui/primary-button"
import { normalizeParticipantReference } from "../_lib/staff-utils"

interface StaffManualEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onEnterAction: (args: { reference: string }) => void
}

export function StaffManualEntryDialog({
  open,
  onOpenChange,
  onEnterAction,
}: StaffManualEntryDialogProps) {
  const [reference, setReference] = useState("")

  useEffect(() => {
    if (open) {
      setReference("")
    }
  }, [open])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    if (!reference.trim()) return

    onEnterAction({
      reference: normalizeParticipantReference(reference),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[40%] max-w-sm border-none bg-[#fbfaf7]">
        <DialogHeader className="text-center">
          <DialogTitle className="font-gothic text-xl font-medium tracking-tight">Enter participant number</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
          <Input
            autoFocus
            type="number"
            inputMode="numeric"
            placeholder="0000"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="h-16 text-center font-mono text-4xl tracking-[0.25em]"
          />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <PrimaryButton type="submit" className="flex-1" disabled={!reference.trim()}>
              Continue
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
