"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Trash2,
  CheckCircle,
  X,
  Loader2,
  RefreshCw,
  FileCode,
  FileImage,
  ClipboardCheck,
} from "lucide-react"
import { useState } from "react"

interface SubmissionsBulkToolbarProps {
  marathonMode?: string
  selectedCount: number
  canVerify: boolean
  completableCount: number
  isDeleting: boolean
  isVerifying: boolean
  isMarkingCompleted: boolean
  isReTriggering: boolean
  isRerunningValidations: boolean
  isRegeneratingExif: boolean
  isGeneratingThumbnails: boolean
  missingExifCount: number
  missingThumbnailCount: number
  onClearSelection: () => void
  onDelete: () => void
  onVerify: () => void
  onMarkCompleted: () => void
  onReTriggerUploadFlow: () => void
  onRerunValidations: () => void
  onRegenerateExif: () => void
  onGenerateThumbnails: () => void
}

export function SubmissionsBulkToolbar({
  marathonMode,
  selectedCount,
  canVerify,
  completableCount,
  isDeleting,
  isVerifying,
  isMarkingCompleted,
  isReTriggering,
  isRerunningValidations,
  isRegeneratingExif,
  isGeneratingThumbnails,
  missingExifCount,
  missingThumbnailCount,
  onClearSelection,
  onDelete,
  onVerify,
  onMarkCompleted,
  onReTriggerUploadFlow,
  onRerunValidations,
  onRegenerateExif,
  onGenerateThumbnails,
}: SubmissionsBulkToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMarkCompletedDialog, setShowMarkCompletedDialog] = useState(false)
  const isByCameraMode = marathonMode === "by-camera"

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleConfirmDelete = () => {
    onDelete()
    setShowDeleteDialog(false)
  }

  const handleConfirmMarkCompleted = () => {
    onMarkCompleted()
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
        {!isByCameraMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMarkCompletedDialog(true)}
            disabled={completableCount === 0 || isMarkingCompleted}
            className="h-9"
          >
            {isMarkingCompleted ? (
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
            onClick={onVerify}
            disabled={!canVerify || isVerifying}
            className="h-9"
          >
            {isVerifying ? (
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
              onClick={onRerunValidations}
              disabled={isRerunningValidations}
              className="h-9"
            >
              {isRerunningValidations ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Rerun Validations
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerateExif}
              disabled={missingExifCount === 0 || isRegeneratingExif}
              className="h-9"
            >
              {isRegeneratingExif ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileCode className="h-4 w-4 mr-1" />
              )}
              Regenerate EXIF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerateThumbnails}
              disabled={missingThumbnailCount === 0 || isGeneratingThumbnails}
              className="h-9"
            >
              {isGeneratingThumbnails ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileImage className="h-4 w-4 mr-1" />
              )}
              Generate Thumbnails
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onReTriggerUploadFlow}
          disabled={isReTriggering}
          className="h-9"
        >
          {isReTriggering ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Re-trigger Upload Flow
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className="h-9"
        >
          {isDeleting ? (
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
              {selectedCount === 1 ? "" : "s"}? This action cannot be undone.
              {!isByCameraMode && canVerify === false && selectedCount > 0 && (
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
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Delete {selectedCount} Participant
              {selectedCount === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMarkCompletedDialog} onOpenChange={setShowMarkCompletedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Participants Completed</DialogTitle>
            <DialogDescription>
              This will set {completableCount} selected participant
              {completableCount === 1 ? "" : "s"} to completed. Only do this when you are sure
              their uploads are actually complete.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMarkCompletedDialog(false)}
              disabled={isMarkingCompleted}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmMarkCompleted} disabled={isMarkingCompleted}>
              {isMarkingCompleted && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Mark Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
