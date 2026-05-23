'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Trash2,
  CheckCircle,
  X,
  Loader2,
  RefreshCw,
  FileCode,
  FileImage,
  ClipboardCheck,
} from 'lucide-react'
import { useState } from 'react'
import { useSubmissionsBulkActions } from '../_hooks/use-submissions-bulk-actions'
import type { SubmissionTableRow } from '../_lib/submissions-types'
import { useDomain } from '@/lib/domain-provider'

interface SubmissionsBulkToolbarProps {
  marathonMode?: string
  participants: SubmissionTableRow[]
  selectedIds: ReadonlySet<number>
  selectedCount: number
  canVerifySelected: boolean
  onClearSelection: () => void
}

export function SubmissionsBulkToolbar({
  marathonMode,
  participants,
  selectedIds,
  selectedCount,
  canVerifySelected,
  onClearSelection,
}: SubmissionsBulkToolbarProps) {
  const domain = useDomain()
  const { counts, pending, actions } = useSubmissionsBulkActions({
    domain,
    participants,
    selectedIds,
    selectedCount,
    canVerifySelected,
    clearSelection: onClearSelection,
  })
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMarkCompletedDialog, setShowMarkCompletedDialog] = useState(false)
  const isByCameraMode = marathonMode === 'by-camera'

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = () => {
    actions.deleteSelected()
    setShowDeleteDialog(false)
  }

  const handleConfirmMarkCompleted = () => {
    actions.markCompleted()
    setShowMarkCompletedDialog(false)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-card rounded-md border border-border h-9 pl-3 pr-1">
          <span className="text-sm text-muted-foreground bg-card">{selectedCount} selected</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="h-6 w-6 px-2 text-muted-foreground hover:text-foreground rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-4 w-px bg-border mx-1" />
        {isByCameraMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMarkCompletedDialog(true)}
            disabled={counts.completableCount === 0 || pending.isMarkingCompleted}
            className="h-9"
          >
            {pending.isMarkingCompleted ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4 mr-1" />
            )}
            Mark Completed
          </Button>
        )}
        {!isByCameraMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={actions.verifySelected}
            disabled={!canVerifySelected || pending.isVerifying}
            className="h-9"
          >
            {pending.isVerifying ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-1" />
            )}
            Verify
          </Button>
        )}
        {isByCameraMode && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={actions.rerunValidations}
              disabled={pending.isRerunningValidations}
              className="h-9"
            >
              {pending.isRerunningValidations ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Rerun Validations
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={actions.regenerateExif}
              disabled={counts.missingExifCount === 0 || pending.isRegeneratingExif}
              className="h-9"
            >
              {pending.isRegeneratingExif ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileCode className="h-4 w-4 mr-1" />
              )}
              Regenerate EXIF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={actions.generateThumbnails}
              disabled={counts.missingThumbnailCount === 0 || pending.isGeneratingThumbnails}
              className="h-9"
            >
              {pending.isGeneratingThumbnails ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileImage className="h-4 w-4 mr-1" />
              )}
              Generate Thumbnails
            </Button>
          </>
        )}
        {/* <Button
          variant="outline"
          size="sm"
          onClick={actions.reTriggerUploadFlow}
          disabled={pending.isReTriggering}
          className="h-9"
        >
          {pending.isReTriggering ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Re-trigger Upload Flow
        </Button> */}
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteClick}
          disabled={pending.isDeleting}
          className="h-9"
        >
          {pending.isDeleting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-1" />
          )}
          Delete
        </Button>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Participants</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCount} participant
              {selectedCount === 1 ? '' : 's'}? This action cannot be undone.
              {!isByCameraMode && canVerifySelected === false && selectedCount > 0 && (
                <span className="block mt-2 text-destructive">
                  Note: Some selected participants are not in &quot;completed&quot; status and
                  cannot be verified, but they can still be deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={pending.isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={pending.isDeleting}
            >
              {pending.isDeleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Delete {selectedCount} Participant
              {selectedCount === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMarkCompletedDialog} onOpenChange={setShowMarkCompletedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Participants Completed</DialogTitle>
            <DialogDescription>
              This will set {counts.completableCount} selected participant
              {counts.completableCount === 1 ? '' : 's'} to completed. Only do this when you are
              sure their uploads are actually complete.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMarkCompletedDialog(false)}
              disabled={pending.isMarkingCompleted}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmMarkCompleted} disabled={pending.isMarkingCompleted}>
              {pending.isMarkingCompleted && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Mark Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
