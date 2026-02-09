"use client"

import { useForm } from "@tanstack/react-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useEffect } from "react"

interface CreateTopicDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  showActiveToggle?: boolean
  defaultActive?: boolean
}

export function TopicsCreateDialog({
  isOpen,
  onOpenChange,
  showActiveToggle = false,
  defaultActive = true,
}: CreateTopicDialogProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { mutate: createTopic, isPending: isCreatingTopic } = useMutation(
    trpc.topics.create.mutationOptions({
      onSuccess: () => {
        form.reset()
        onOpenChange(false)
        toast.success("Topic created")
      },
      onError: (error) => {
        toast.error(error.message)
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
      },
    })
  )

  const form = useForm({
    defaultValues: {
      name: "",
      visibility: true,
      activate: showActiveToggle ? defaultActive : false,
    },
    onSubmit: async ({ value }) => {
      const visibility = value.visibility ? "public" : "private"
      const data = {
        name: value.name,
        visibility: visibility as
          | "public"
          | "private"
          | "scheduled"
          | "active",
        ...(showActiveToggle && value.activate ? { activate: true } : {}),
      }
      createTopic({
        domain,
        data: {
          ...data,
        },
      })
    },
  })

  useEffect(() => {
    if (isOpen) {
      form.reset()
    }
  }, [isOpen, form])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Topic</DialogTitle>
          <DialogDescription>
            Add a new topic to your marathon. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                if (!value || value.length < 1) {
                  return "Name is required"
                }
                return undefined
              },
            }}
            children={(field) => (
              <div className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Name
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Enter topic name"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length ? (
                  <p className="text-sm text-destructive mt-1">
                    {field.state.meta.errors.join(", ")}
                  </p>
                ) : null}
              </div>
            )}
          />

          <form.Field
            name="visibility"
            children={(field) => (
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Visibility
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Make topic visible to participants
                  </p>
                </div>
                <Checkbox
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(!!checked)}
                />
              </div>
            )}
          />

          {showActiveToggle ? (
            <form.Field
              name="activate"
              children={(field) => (
                <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Make active
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Mark this topic as the active one
                    </p>
                  </div>
                  <Switch
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked)}
                  />
                </div>
              )}
            />
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} type="button" size="sm">
              Cancel
            </Button>
            <PrimaryButton type="submit" disabled={isCreatingTopic}>
              {isCreatingTopic ? "Creating..." : "Create Topic"}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
