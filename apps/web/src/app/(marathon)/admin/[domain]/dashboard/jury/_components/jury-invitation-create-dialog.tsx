"use client"

import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { PrimaryButton } from "@/components/ui/primary-button"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { useDomain } from "@/lib/domain-provider"
import { Input } from "@/components/ui/input"
import { Gavel, Send, Users, Tag } from "lucide-react"
import { addDays } from "date-fns"
import { useForm } from "@tanstack/react-form"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface JuryInvitationCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvitationCreated?: (invitationId: number) => void
}

type FormValues = {
  inviteType: "topic" | "class"
  displayName: string
  email: string
  notes: string
  topicId: string
  competitionClassId: string
  deviceGroupId: string
  expiryDays: number
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">{children}</p>
  )
}

export function JuryInvitationCreateDialog({
  open,
  onOpenChange,
  onInvitationCreated,
}: JuryInvitationCreateDialogProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const competitionClasses = marathon?.competitionClasses || []
  const topics = marathon?.topics || []
  const deviceGroups = marathon?.deviceGroups || []

  const { mutate: createJuryInvitation, isPending: isCreatingJuryInvitation } = useMutation(
    trpc.jury.createJuryInvitation.mutationOptions({
      onSuccess: async (invitationData) => {
        if (!invitationData) {
          toast.error("Failed to create jury invitation")
          return
        }

        toast.success("Jury invitation created successfully")
        form.reset()
        onOpenChange(false)
        onInvitationCreated?.(invitationData.id)
        queryClient.invalidateQueries({
          queryKey: trpc.jury.getJuryInvitationsByDomain.queryKey({ domain }),
        })
      },
      onError: (error) => {
        console.error(error)
        toast.error(error.message || "Failed to create jury invitation")
      },
    }),
  )

  const form = useForm({
    defaultValues: {
      inviteType: "topic",
      displayName: "",
      email: "",
      notes: "",
      topicId: "",
      competitionClassId: "",
      deviceGroupId: "",
      expiryDays: 14,
    } as FormValues,
    onSubmit: async ({ value }) => {
      let parsedCompetitionClassId: number | undefined
      let parsedDeviceGroupId: number | undefined
      let parsedTopicId: number | undefined

      if (value.inviteType === "topic") {
        if (!value.topicId || value.topicId === "all") {
          toast.error("Please select a topic for the invitation")
          return
        }
        parsedTopicId = parseInt(value.topicId)
        parsedCompetitionClassId = undefined
        parsedDeviceGroupId = undefined
      } else if (value.inviteType === "class") {
        if (!value.competitionClassId || value.competitionClassId === "all") {
          toast.error("Please select a competition class for the invitation")
          return
        }
        parsedCompetitionClassId = parseInt(value.competitionClassId)
        parsedDeviceGroupId =
          !value.deviceGroupId || value.deviceGroupId === "all"
            ? undefined
            : parseInt(value.deviceGroupId)
        parsedTopicId = undefined
      }

      const expiresAt = addDays(new Date(), value.expiryDays ?? 14)
      expiresAt.setHours(23, 59, 59, 999)

      createJuryInvitation({
        domain,
        data: {
          displayName: value.displayName,
          email: value.email,
          inviteType: value.inviteType as "topic" | "class",
          expiresAt: expiresAt.toISOString(),
          competitionClassId: parsedCompetitionClassId,
          deviceGroupId: parsedDeviceGroupId,
          topicId: parsedTopicId,
          notes: value.notes || undefined,
          status: "pending",
        },
      })
    },
  })

  const handleOpenChange = (next: boolean) => {
    if (!next && isCreatingJuryInvitation) return
    onOpenChange(next)
    if (!next) {
      form.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={!isCreatingJuryInvitation}
        className={cn(
          "flex max-h-[min(88dvh,780px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]",
          "border-border shadow-lg",
        )}
      >
        <div className="shrink-0 border-b border-border bg-muted/25 px-6 pb-4 pt-5">
          <DialogHeader className="gap-3 text-left">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10">
                <Gavel className="h-5 w-5 text-brand-primary" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1 space-y-1 pr-8">
                <DialogTitle className="font-gothic text-xl font-medium tracking-tight">
                  Invite a jury member
                </DialogTitle>
                <DialogDescription className="text-[13px] leading-snug text-muted-foreground">
                  They get a secure link to review submissions. You can share the link from the list
                  after sending.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              <form.Field
                name="inviteType"
                validators={{
                  onChange: ({ value }) => {
                    return !value ? "Please select an invite type" : undefined
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <SectionLabel>Review scope</SectionLabel>
                    <Label className="text-sm font-medium">What should they evaluate?</Label>
                    <form.Subscribe selector={(formState) => formState.values.inviteType}>
                      {(inviteType) => (
                        <Tabs
                          value={inviteType}
                          onValueChange={(value) => field.handleChange(value as "topic" | "class")}
                          className="w-full"
                        >
                          <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg bg-muted/60 p-1">
                            <TabsTrigger
                              value="topic"
                              className="gap-2 rounded-md text-xs data-[state=active]:shadow-sm"
                            >
                              <Tag className="h-3.5 w-3.5" />
                              Single topic
                            </TabsTrigger>
                            <TabsTrigger
                              value="class"
                              className="gap-2 rounded-md text-xs data-[state=active]:shadow-sm"
                            >
                              <Users className="h-3.5 w-3.5" />
                              Class series
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      )}
                    </form.Subscribe>
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-destructive">
                        {typeof field.state.meta.errors[0] === "string"
                          ? field.state.meta.errors[0]
                          : "Invalid input"}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <Separator className="bg-border/80" />

              <div className="space-y-4">
                <SectionLabel>Jury member</SectionLabel>

                <form.Field
                  name="displayName"
                  validators={{
                    onChange: ({ value }) => {
                      return !value ? "Display name is required" : undefined
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="jury-dialog-name" className="text-sm font-medium">
                        Name
                      </Label>
                      <Input
                        id="jury-dialog-name"
                        placeholder="e.g. Jane Smith"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="h-10"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {typeof field.state.meta.errors[0] === "string"
                            ? field.state.meta.errors[0]
                            : "Invalid input"}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field
                  name="email"
                  validators={{
                    onChange: ({ value }) => {
                      if (!value) return "Email is required"
                      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                      return !emailRegex.test(value) ? "Invalid email address" : undefined
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="jury-dialog-email" className="text-sm font-medium">
                        Email
                      </Label>
                      <Input
                        id="jury-dialog-email"
                        type="email"
                        placeholder="jury@example.com"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="h-10"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {typeof field.state.meta.errors[0] === "string"
                            ? field.state.meta.errors[0]
                            : "Invalid input"}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>
              </div>

              <form.Subscribe selector={(formState) => formState.values.inviteType}>
                {(inviteType) => (
                  <>
                    <Separator className="bg-border/80" />
                    <div className="space-y-4">
                      <SectionLabel>Assignment</SectionLabel>

                      {inviteType === "topic" && (
                        <form.Field
                          name="topicId"
                          validators={{
                            onChange: ({ value }) => {
                              return !value ? "Please select a topic" : undefined
                            },
                          }}
                        >
                          {(field) => (
                            <div className="space-y-1.5">
                              <Label className="text-sm font-medium">
                                Topic <span className="text-destructive">*</span>
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                All uploaded submissions for this topic.
                              </p>
                              <Select value={field.state.value} onValueChange={field.handleChange}>
                                <SelectTrigger className="h-10 w-full">
                                  <SelectValue placeholder="Select a topic" />
                                </SelectTrigger>
                                <SelectContent>
                                  {topics
                                    .sort((a, b) => a.orderIndex - b.orderIndex)
                                    .map((topic) => (
                                      <SelectItem key={topic.id} value={topic.id.toString()}>
                                        {topic.orderIndex + 1}. {topic.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {typeof field.state.meta.errors[0] === "string"
                                    ? field.state.meta.errors[0]
                                    : "Invalid input"}
                                </p>
                              )}
                            </div>
                          )}
                        </form.Field>
                      )}

                      {inviteType === "class" && (
                        <>
                          <form.Field
                            name="competitionClassId"
                            validators={{
                              onChange: ({ value }) => {
                                return !value ? "Please select a competition class" : undefined
                              },
                            }}
                          >
                            {(field) => (
                              <div className="space-y-1.5">
                                <Label className="text-sm font-medium">
                                  Competition class <span className="text-destructive">*</span>
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Participants in this class, as a contact sheet view.
                                </p>
                                <Select value={field.state.value} onValueChange={field.handleChange}>
                                  <SelectTrigger className="h-10 w-full">
                                    <SelectValue placeholder="Select a class" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {competitionClasses.map((cls) => (
                                      <SelectItem key={cls.id} value={cls.id.toString()}>
                                        {cls.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {field.state.meta.errors.length > 0 && (
                                  <p className="text-sm text-destructive">
                                    {typeof field.state.meta.errors[0] === "string"
                                      ? field.state.meta.errors[0]
                                      : "Invalid input"}
                                  </p>
                                )}
                              </div>
                            )}
                          </form.Field>

                          <form.Field name="deviceGroupId">
                            {(field) => (
                              <div className="space-y-1.5">
                                <Label className="text-sm font-medium">Device group</Label>
                                <p className="text-xs text-muted-foreground">
                                  Optional filter within the class.
                                </p>
                                <Select value={field.state.value} onValueChange={field.handleChange}>
                                  <SelectTrigger className="h-10 w-full">
                                    <SelectValue placeholder="All device groups" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All device groups</SelectItem>
                                    {deviceGroups.map((group) => (
                                      <SelectItem key={group.id} value={group.id.toString()}>
                                        {group.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </form.Field>
                        </>
                      )}
                    </div>
                  </>
                )}
              </form.Subscribe>

              <Separator className="bg-border/80" />

              <div className="space-y-4">
                <SectionLabel>Link</SectionLabel>

                <form.Field
                  name="expiryDays"
                  validators={{
                    onChange: ({ value }) => {
                      const num = Number(value)
                      if (num < 1) return "Expiry must be at least 1 day"
                      if (num > 90) return "Expiry cannot exceed 90 days"
                      return undefined
                    },
                  }}
                >
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="jury-dialog-expiry" className="text-sm font-medium">
                        Expires in (days)
                      </Label>
                      <p className="text-xs text-muted-foreground">1–90. Link stops working after this.</p>
                      <Input
                        id="jury-dialog-expiry"
                        type="number"
                        min={1}
                        max={90}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(Number(e.target.value))}
                        onBlur={field.handleBlur}
                        className="h-10 max-w-[120px]"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {typeof field.state.meta.errors[0] === "string"
                            ? field.state.meta.errors[0]
                            : "Invalid input"}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name="notes">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label htmlFor="jury-dialog-notes" className="text-sm font-medium">
                        Notes <span className="font-normal text-muted-foreground">(optional)</span>
                      </Label>
                      <Textarea
                        id="jury-dialog-notes"
                        placeholder="Instructions or context for the jury member…"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        rows={3}
                        className="min-h-[80px] resize-y"
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-muted/15 px-6 py-4">
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                disabled={isCreatingJuryInvitation}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <form.Subscribe selector={(formState) => [formState.canSubmit, formState.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <PrimaryButton
                    type="submit"
                    disabled={!canSubmit || isCreatingJuryInvitation}
                    className="gap-2 min-w-[140px]"
                  >
                    <Send className="h-4 w-4" />
                    {isSubmitting || isCreatingJuryInvitation ? "Creating…" : "Create invitation"}
                  </PrimaryButton>
                )}
              </form.Subscribe>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
