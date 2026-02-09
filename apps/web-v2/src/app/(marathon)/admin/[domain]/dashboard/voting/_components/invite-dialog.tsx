import { useEffect, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { addHours } from "date-fns"
import { Copy, Loader2, Trophy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  toDateTimeLocalValue,
  toIsoFromLocal,
  hasValidDateRange,
} from "../_lib/utils"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useDomain } from "@/lib/domain-provider"

interface InviteDialogProps {
  open: boolean
  activeTopic: { id: number; name: string; orderIndex: number }
  onOpenChange: (open: boolean) => void
  votingWindowStartsAt?: string | null
  votingWindowEndsAt?: string | null
}

export function InviteDialog({
  open,
  activeTopic,
  onOpenChange,
  votingWindowStartsAt,
  votingWindowEndsAt,
}: InviteDialogProps) {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const domain = useDomain()
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null)


  const createManualVotingMutation = useMutation(
    trpc.voting.createManualVotingSession.mutationOptions({
      onSuccess: async (data) => {
        setCreatedInviteUrl(data.votingUrl)
        toast.success("Manual voting invite created")
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingAdminSummary.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.voting.getVotingVotersPage.pathKey(),
          }),
        ])
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create manual invite")
      },
    }),
  )

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      startsAt: toDateTimeLocalValue(new Date()),
      endsAt: toDateTimeLocalValue(addHours(new Date(), 24)),
    },
    onSubmit: async ({ value }) => {
      const startsAtIso = toIsoFromLocal(value.startsAt)
      const endsAtIso = toIsoFromLocal(value.endsAt)

      if (!startsAtIso || !endsAtIso) {
        toast.error("Please provide valid start and end timestamps")
        return
      }

      if (!hasValidDateRange(startsAtIso, endsAtIso)) {
        toast.error("End timestamp must be later than start timestamp")
        return
      }

      createManualVotingMutation.mutate({
        domain,
        topicId: activeTopic.id,
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        startsAt: startsAtIso,
        endsAt: endsAtIso,
      })
    },
  })

  useEffect(() => {
    if (open && !createdInviteUrl) {
      const startsAt = votingWindowStartsAt
        ? toDateTimeLocalValue(new Date(votingWindowStartsAt))
        : toDateTimeLocalValue(new Date())
      const endsAt = votingWindowEndsAt
        ? toDateTimeLocalValue(new Date(votingWindowEndsAt))
        : toDateTimeLocalValue(addHours(new Date(), 24))

      form.setFieldValue("firstName", "")
      form.setFieldValue("lastName", "")
      form.setFieldValue("email", "")
      form.setFieldValue("startsAt", startsAt)
      form.setFieldValue("endsAt", endsAt)
    }
  }, [open, createdInviteUrl, votingWindowStartsAt, votingWindowEndsAt, form])

  const handleCopyInviteLink = async () => {
    if (!createdInviteUrl) return
    await navigator.clipboard.writeText(createdInviteUrl)
    toast.success("Invite link copied to clipboard")
  }

  const handleReset = () => {
    form.reset()
    setCreatedInviteUrl(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create manual voting invite</DialogTitle>
          <DialogDescription>
            Create a voting session for a non-participant voter and copy the
            generated link.
          </DialogDescription>
        </DialogHeader>

        {createdInviteUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="created-vote-link">Invite link</Label>
              <div className="flex gap-2">
                <Input
                  id="created-vote-link"
                  value={createdInviteUrl}
                  readOnly
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyInviteLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleReset}>
                Create Another
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field
                name="firstName"
                validators={{
                  onChange: ({ value }) =>
                    !value ? "First name is required" : undefined,
                }}
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>First name</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Jane"
                    />
                    {field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0 && (
                        <em className="text-sm text-red-600">
                          {field.state.meta.errors.join(", ")}
                        </em>
                      )}
                  </div>
                )}
              />

              <form.Field
                name="lastName"
                validators={{
                  onChange: ({ value }) =>
                    !value ? "Last name is required" : undefined,
                }}
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Last name</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Doe"
                    />
                    {field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0 && (
                        <em className="text-sm text-red-600">
                          {field.state.meta.errors.join(", ")}
                        </em>
                      )}
                  </div>
                )}
              />
            </div>

            <form.Field
              name="email"
              validators={{
                onChange: ({ value }) => {
                  if (!value) return "Email is required"
                  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return "Invalid email address"
                  }
                  return undefined
                },
              }}
              children={(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>Email</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="voter@example.com"
                  />
                  {field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0 && (
                      <em className="text-sm text-red-600">
                        {field.state.meta.errors.join(", ")}
                      </em>
                    )}
                </div>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <form.Field
                name="startsAt"
                validators={{
                  onChange: ({ value }) =>
                    !value ? "Start timestamp is required" : undefined,
                }}
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Start timestamp</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="datetime-local"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0 && (
                        <em className="text-sm text-red-600">
                          {field.state.meta.errors.join(", ")}
                        </em>
                      )}
                  </div>
                )}
              />

              <form.Field
                name="endsAt"
                validators={{
                  onChange: ({ value }) =>
                    !value ? "End timestamp is required" : undefined,
                }}
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>End timestamp</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="datetime-local"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0 && (
                        <em className="text-sm text-red-600">
                          {field.state.meta.errors.join(", ")}
                        </em>
                      )}
                  </div>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={createManualVotingMutation.isPending}>
                {createManualVotingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating invite...
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 mr-2" />
                    Create Invite
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
