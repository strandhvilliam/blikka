import { useState } from "react"
import { useForm } from "@tanstack/react-form"
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
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useDomain } from "@/lib/domain-provider"

interface InviteDialogProps {
  open: boolean
  activeTopic: { id: number; name: string; orderIndex: number }
  onOpenChange: (open: boolean) => void
}

export function InviteDialog({
  open,
  activeTopic,
  onOpenChange,
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
    },
    onSubmit: async ({ value }) => {
      createManualVotingMutation.mutate({
        domain,
        topicId: activeTopic.id,
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
      })
    },
  })

  const handleCopyInviteLink = async () => {
    if (!createdInviteUrl) return
    await navigator.clipboard.writeText(createdInviteUrl)
    toast.success("Invite link copied to clipboard")
  }

  const handleReset = () => {
    form.reset()
    setCreatedInviteUrl(null)
  }

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen)
    if (isOpen) {
      form.reset()
      setCreatedInviteUrl(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              >
                {(field) => (
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
              </form.Field>

              <form.Field
                name="lastName"
                validators={{
                  onChange: ({ value }) =>
                    !value ? "Last name is required" : undefined,
                }}
              >
                {(field) => (
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
              </form.Field>
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
            >
              {(field) => (
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
            </form.Field>

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
