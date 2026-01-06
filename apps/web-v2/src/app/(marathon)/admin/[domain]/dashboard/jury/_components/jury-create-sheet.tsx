"use client"

import { useState } from "react"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { PrimaryButton } from "@/components/ui/primary-button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useDomain } from "@/lib/domain-provider"
import { Input } from "@/components/ui/input"
import { Send, Users, Tag } from "lucide-react"
import { addDays } from "date-fns"
import { useForm } from "@tanstack/react-form"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"

interface JuryInvitationCreateSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function JuryInvitationCreateSheet({ open, onOpenChange }: JuryInvitationCreateSheetProps) {
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
        queryClient.invalidateQueries({
          queryKey: trpc.jury.getJuryInvitationsByDomain.queryKey({ domain }),
        })
      },
      onError: (error) => {
        console.error(error)
        toast.error(error.message || "Failed to create jury invitation")
      },
    })
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
    },
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

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) {
          form.reset()
        }
      }}
    >
      <SheetContent className="sm:max-w-md md:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>Create Jury Invitation</SheetTitle>
          <SheetDescription>
            Send an invitation to a jury member to rate submissions. The link will contain a secure
            token valid for the specified period.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="space-y-6 py-4"
        >
          <form.Field
            name="inviteType"
            validators={{
              onChange: ({ value }) => {
                return !value ? "Please select an invite type" : undefined
              },
            }}
          >
            {(field) => (
              <div>
                <Label>Invitation Type</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Should the jury member review a single topic or class series?
                </p>
                <form.Subscribe selector={(formState) => formState.values.inviteType}>
                  {(inviteType) => (
                    <Tabs
                      value={inviteType}
                      onValueChange={(value) => field.handleChange(value as "topic" | "class")}
                      className="mt-2"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="topic" className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Topic
                        </TabsTrigger>
                        <TabsTrigger value="class" className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Class
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  )}
                </form.Subscribe>
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-red-500 mt-1">
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
              <div>
                <Label htmlFor="jury-email">Jury Member Email</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  The email address of the jury member where the invitation will be sent.
                </p>
                <Input
                  id="jury-email"
                  type="email"
                  placeholder="jury@example.com"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="mt-2"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-red-500 mt-1">
                    {typeof field.state.meta.errors[0] === "string"
                      ? field.state.meta.errors[0]
                      : "Invalid input"}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Field
            name="displayName"
            validators={{
              onChange: ({ value }) => {
                return !value ? "Display name is required" : undefined
              },
            }}
          >
            {(field) => (
              <div>
                <Label htmlFor="jury-name">Display Name</Label>
                <p className="text-xs text-muted-foreground mb-2">The name of the jury member.</p>
                <Input
                  id="jury-name"
                  placeholder="John Doe"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="mt-2"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-red-500 mt-1">
                    {typeof field.state.meta.errors[0] === "string"
                      ? field.state.meta.errors[0]
                      : "Invalid input"}
                  </p>
                )}
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(formState) => formState.values.inviteType}>
            {(inviteType) => (
              <>
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
                      <div>
                        <Label>
                          Topic <span className="text-red-500">*</span>
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Jury will review all submissions for this specific topic.
                        </p>
                        <Select value={field.state.value} onValueChange={field.handleChange}>
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Select a topic" />
                          </SelectTrigger>
                          <SelectContent>
                            {topics
                              .sort((a, b) => a.orderIndex - b.orderIndex)
                              .map((topic) => (
                                <SelectItem key={topic.id} value={topic.id.toString()}>
                                  {`${topic.orderIndex + 1} - ${topic.name}`}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {field.state.meta.errors.length > 0 && (
                          <p className="text-sm text-red-500 mt-1">
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
                        <div>
                          <Label>
                            Competition Class <span className="text-red-500">*</span>
                          </Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Jury will review participants&apos; submissions as a &apos;contact
                            sheet&apos;.
                          </p>
                          <Select value={field.state.value} onValueChange={field.handleChange}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select a competition class" />
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
                            <p className="text-sm text-red-500 mt-1">
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
                        <div>
                          <Label>Device Group (Optional)</Label>
                          <Select value={field.state.value} onValueChange={field.handleChange}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select a device group" />
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
              </>
            )}
          </form.Subscribe>

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
              <div>
                <Label htmlFor="expiry">Expiry (days)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Deadline to review the submissions. Link will be invalid after expiry.
                </p>
                <Input
                  id="expiry"
                  type="number"
                  min="1"
                  max="90"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                  onBlur={field.handleBlur}
                  className="mt-2"
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-red-500 mt-1">
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
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Additional notes for the jury member.
                </p>
                <Textarea
                  id="notes"
                  placeholder="Additional notes for the jury member..."
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="mt-2"
                />
              </div>
            )}
          </form.Field>

          <SheetFooter className="pt-4">
            <form.Subscribe selector={(formState) => [formState.canSubmit, formState.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <PrimaryButton type="submit" disabled={!canSubmit || isCreatingJuryInvitation}>
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting || isCreatingJuryInvitation ? "Sending..." : "Send Invitation"}
                </PrimaryButton>
              )}
            </form.Subscribe>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
