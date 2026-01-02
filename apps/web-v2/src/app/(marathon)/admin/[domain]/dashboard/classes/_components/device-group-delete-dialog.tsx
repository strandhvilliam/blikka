"use client"

import { useState, useEffect } from "react"
import type { DeviceGroup } from "@blikka/db"
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

interface DeleteDeviceGroupDialogProps {
  group: DeviceGroup | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (group: DeviceGroup) => void
}

export function DeviceGroupDeleteDialog({
  group,
  isOpen,
  onOpenChange,
  onConfirm,
}: DeleteDeviceGroupDialogProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  const handleConfirm = () => {
    if (!group || deleteConfirmation !== group.name) return
    onConfirm(group)
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
            Delete Device Group: {group?.name}
          </DialogTitle>
          <div className="pt-2 text-muted-foreground text-sm">
            <div className="space-y-4">
              <div className="bg-destructive/10 p-3 rounded-md border border-destructive/20">
                <p className="text-sm font-medium">
                  This is a dangerous action. Deleting this device group will:
                </p>
                <ul className="text-sm mt-2 list-disc pl-5 space-y-1">
                  <li>Remove the device group permanently</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmDelete" className="text-sm text-foreground">
                  To confirm, type the device group name:{" "}
                  <span className="font-semibold">{group?.name}</span>
                </Label>
                <Input
                  id="confirmDelete"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type device group name here"
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
            disabled={!group || deleteConfirmation !== group.name}
          >
            Delete Device Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

