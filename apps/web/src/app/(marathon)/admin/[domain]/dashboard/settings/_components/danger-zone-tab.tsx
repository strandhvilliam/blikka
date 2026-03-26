"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, DatabaseZap, Loader2 } from "lucide-react"
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
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { SmsTestSection } from "./sms-test-section"

interface DangerZoneProps {
  marathonName: string
  onReset: () => Promise<void>
  isResettingMarathon: boolean
}

export { DangerZoneSection as DangerZoneTab }

export function DangerZoneSection({ marathonName, onReset, isResettingMarathon }: DangerZoneProps) {
  const trpc = useTRPC()
  const domain = useDomain()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [resetConfirmationText, setResetConfirmationText] = useState("")
  const [seedConfirmationText, setSeedConfirmationText] = useState("")
  const [lastSeedSummary, setLastSeedSummary] = useState<string | null>(null)
  const isDevelopment = process.env.NODE_ENV !== "production"
  const isResetDisabled = resetConfirmationText !== marathonName || isResettingMarathon
  const expectedSeedConfirmation = `seed ${domain}`

  const seedStatusQuery = useQuery({
    ...trpc.marathons.getSeedScenarioStatus.queryOptions({
      domain,
    }),
    enabled: isDevelopment,
  })

  const seedMutation = useMutation(
    trpc.marathons.seedFinishedScenario.mutationOptions({
      onSuccess: async (result) => {
        setSeedConfirmationText("")
        setLastSeedSummary(
          `Seeded ${result.participantsCreated} participants, ${result.submissionsCreated} submissions, and ${result.validationResultsCreated} validation results for ${result.mode}.`,
        )
        toast.success("Seed demo data completed")
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.marathons.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.participants.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.topics.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.competitionClasses.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.deviceGroups.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.jury.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.validations.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.contactSheets.pathKey(),
          }),
        ])
        router.refresh()
      },
      onError: (error) => {
        toast.error(error.message || "Failed to seed demo data")
      },
    }),
  )

  const handleReset = async () => {
    try {
      await onReset()
      setResetConfirmationText("")
    } catch {
      // Error already shown by toast
    }
  }

  const seedStatus = seedStatusQuery.data
  const isSeedDisabled =
    seedConfirmationText !== expectedSeedConfirmation ||
    !seedStatus?.canRun ||
    seedMutation.isPending ||
    seedStatusQuery.isLoading

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
        <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
          Danger Zone
        </p>
      </div>
      <Alert variant="destructive" className="bg-destructive/10">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <AlertTitle className="font-gothic">Danger Zone</AlertTitle>
        <AlertDescription>
          <div className="space-y-4">
            <p>
              Reset this marathon to clear all participants, submissions, topics, competition
              classes, and device groups. This action cannot be undone.
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
                    This action cannot be undone. This will permanently delete all:
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
                  <AlertDialogCancel onClick={() => setResetConfirmationText("")}>
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

      {isDevelopment ? (
        <Alert className="mt-6 border-[#FFB792] bg-[#FFF5EE] text-[#6B2E18]">
          <DatabaseZap className="h-4 w-4" aria-hidden />
          <AlertTitle className="font-gothic">Seed Demo Data</AlertTitle>
          <AlertDescription>
            <div className="space-y-4">
              <p>
                Replace runtime marathon data with a deterministic finished-event demo state for
                this domain. Staff and admin access are preserved.
              </p>

              {seedStatusQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading seed status…
                </div>
              ) : seedStatus ? (
                <div className="space-y-3 rounded-lg border border-[#FFD8C4] bg-white/70 p-4 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="font-medium">Environment:</span> {seedStatus.environment}
                    </div>
                    <div>
                      <span className="font-medium">Mode:</span> {seedStatus.mode}
                    </div>
                    <div>
                      <span className="font-medium">Admin access:</span>{" "}
                      {seedStatus.isAdminForDomain ? "Yes" : "No"}
                    </div>
                    <div>
                      <span className="font-medium">Staff members:</span> {seedStatus.staffCount}
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>Participants: {seedStatus.preview.participants}</div>
                    <div>Topics: {seedStatus.preview.topics}</div>
                    <div>Competition classes: {seedStatus.preview.competitionClasses}</div>
                    <div>Device groups: {seedStatus.preview.deviceGroups}</div>
                  </div>

                  {seedStatus.blockers.length > 0 ? (
                    <div className="space-y-1 rounded-md border border-destructive/20 bg-destructive/5 p-3">
                      {seedStatus.blockers.map((blocker) => (
                        <p key={blocker} className="text-sm text-destructive">
                          {blocker}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-emerald-700">
                      Ready to seed the current {seedStatus.mode} scenario.
                    </p>
                  )}

                  {lastSeedSummary ? (
                    <p className="text-sm text-emerald-700">{lastSeedSummary}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-destructive">Unable to load seed status.</p>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#FF8A5B] text-[#B4461E] hover:bg-[#FFE7DA]"
                    disabled={!seedStatus}
                  >
                    Seed Demo Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-gothic">
                      Replace marathon runtime data?
                    </AlertDialogTitle>
                    <div className="space-y-2 rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
                      This will clear seeded runtime data and recreate:
                      <div className="mt-2 list-disc space-y-1 pl-5">
                        <li>24 topics, 2 competition classes, and 2 device groups</li>
                        <li>30 participants with fully rendered placeholder submissions</li>
                        <li>Mode-specific jury or voting progress</li>
                        <li>Participant verifications in marathon mode</li>
                      </div>
                    </div>
                  </AlertDialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="seed-confirmation">
                      Type <strong>{expectedSeedConfirmation}</strong> to confirm:
                    </Label>
                    <Input
                      id="seed-confirmation"
                      name="seed-confirmation"
                      value={seedConfirmationText}
                      onChange={(event) => setSeedConfirmationText(event.target.value)}
                      placeholder={expectedSeedConfirmation}
                      className="font-mono"
                      autoComplete="off"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setSeedConfirmationText("")}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => seedMutation.mutate({ domain })}
                      disabled={isSeedDisabled}
                      className="bg-[#FF6A3D] text-white hover:bg-[#E65A2E]"
                    >
                      {seedMutation.isPending ? "Seeding…" : "Seed Demo Data"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <SmsTestSection />
    </section>
  )
}
