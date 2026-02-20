"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SmsTestSection } from "./sms-test-section"

interface DangerZoneTabProps {
  marathonName: string
  onReset: () => Promise<void>
  isResettingMarathon: boolean
}

export function DangerZoneTab({
  marathonName,
  onReset,
  isResettingMarathon,
}: DangerZoneTabProps) {
  const [resetConfirmationText, setResetConfirmationText] = useState("")
  const isResetDisabled =
    resetConfirmationText !== marathonName || isResettingMarathon

  const handleReset = async () => {
    try {
      await onReset()
      setResetConfirmationText("")
    } catch {
      // Error already shown by toast
    }
  }

  return (
    <div className="mt-0 bg-white">
      <Alert variant="destructive" className="bg-destructive/10">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <AlertTitle className="font-gothic">Danger Zone</AlertTitle>
        <AlertDescription>
          <div className="space-y-4">
            <p>
              Reset this marathon to clear all participants, submissions,
              topics, competition classes, and device groups. This action cannot
              be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Reset Marathon
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="font-gothic">
                    Are you absolutely sure?
                  </AlertDialogTitle>
                  <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 border border-muted p-4 rounded-lg">
                    This action cannot be undone. This will permanently delete
                    all:
                    <div className="list-disc list-inside mt-2 space-y-1">
                      <li>Participants and their submissions</li>
                      <li>Topics and their content</li>
                      <li>Competition classes and device groups</li>
                      <li>Jury invitations and validation results</li>
                      <li>All related data and configurations</li>
                    </div>
                  </div>
                </AlertDialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirmation">
                    Type <strong>{marathonName}</strong> to confirm:
                  </Label>
                  <Input
                    id="reset-confirmation"
                    name="reset-confirmation"
                    value={resetConfirmationText}
                    onChange={(e) => setResetConfirmationText(e.target.value)}
                    placeholder={marathonName}
                    className="font-mono"
                    autoComplete="off"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onClick={() => setResetConfirmationText("")}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReset}
                    disabled={isResetDisabled}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isResettingMarathon ? "Resetting…" : "Reset Marathon"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </AlertDescription>
      </Alert>

      <SmsTestSection />
    </div>
  )
}
