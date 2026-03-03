"use client"

import { useState, useEffect } from "react"
import type { CompetitionClass } from "@blikka/db"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DeleteCompetitionClassDialogProps {
  classItem: CompetitionClass | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (classItem: CompetitionClass) => void
}

export function CompetitionClassDeleteDialog({
  classItem,
  isOpen,
  onOpenChange,
  onConfirm,
}: DeleteCompetitionClassDialogProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  const handleConfirm = () => {
    if (!classItem || deleteConfirmation !== classItem.name) return
    onConfirm(classItem)
    setDeleteConfirmation("")
  }

  useEffect(() => {
    if (!isOpen) {
      setDeleteConfirmation("")
    }
  }, [isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Competition Class: {classItem?.name}
          </DialogTitle>
          <div className="pt-2 text-muted-foreground text-sm">
            <div className="space-y-4">
              <div className="bg-destructive/10 p-3 rounded-md border border-destructive/20">
                <p className="text-sm font-medium">
                  This is a dangerous action. Deleting this competition class will:
                </p>
                <ul className="text-sm mt-2 list-disc pl-5 space-y-1">
                  <li>Remove the competition class permanently</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmDelete" className="text-sm text-foreground">
                  To confirm, type the competition class name:{" "}
                  <span className="font-semibold">{classItem?.name}</span>
                </Label>
                <Input
                  id="confirmDelete"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type competition class name here"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="sm:justify-between mt-4">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!classItem || deleteConfirmation !== classItem.name}
          >
            Delete Competition Class
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

