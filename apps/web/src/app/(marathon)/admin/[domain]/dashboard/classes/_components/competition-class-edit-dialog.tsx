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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useEffect } from "react"
import { Plus, Minus } from "lucide-react"
import NumberFlow from "@number-flow/react"
import type { CompetitionClass } from "@blikka/db"

interface EditCompetitionClassDialogProps {
  competitionClassId: number | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function CompetitionClassEditDialog({
  competitionClassId,
  isOpen,
  onOpenChange,
}: EditCompetitionClassDialogProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const classes = marathon?.competitionClasses || []
  const topics = marathon?.topics || []
  const competitionClass = competitionClassId
    ? classes.find((c) => c.id === competitionClassId)
    : null

  const { mutate: updateCompetitionClass, isPending: isUpdating } = useMutation(
    trpc.competitionClasses.update.mutationOptions({
      onError: (error) => {
        toast.error("Failed to update competition class", {
          description: error.message,
        })
      },
      onSuccess: () => {
        toast.success("Competition class updated")
        onOpenChange(false)
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
      name: competitionClass?.name || "",
      description: competitionClass?.description || "",
      numberOfPhotos: competitionClass?.numberOfPhotos || 24,
      topicStartIndex: competitionClass?.topicStartIndex || 0,
    },
    onSubmit: async ({ value }) => {
      if (!competitionClassId) return

      updateCompetitionClass({
        domain,
        id: competitionClassId,
        data: {
          name: value.name,
          description: value.description || undefined,
          numberOfPhotos: value.numberOfPhotos,
          topicStartIndex: value.topicStartIndex,
        },
      })
    },
  })

  useEffect(() => {
    if (competitionClass) {
      form.setFieldValue("name", competitionClass.name)
      form.setFieldValue("description", competitionClass.description || "")
      form.setFieldValue("numberOfPhotos", competitionClass.numberOfPhotos)
      form.setFieldValue("topicStartIndex", competitionClass.topicStartIndex)
    }
  }, [competitionClass, form])

  if (!competitionClass) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Competition Class</DialogTitle>
          <DialogDescription>
            Modify the competition class details. These changes will be reflected immediately.
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
                  placeholder="Marathon"
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
            name="description"
            children={(field) => (
              <div className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Description
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Full day challenge with photos"
                />
              </div>
            )}
          />

          <form.Field
            name="numberOfPhotos"
            validators={{
              onChange: ({ value }) => {
                if (value < 1 || value > 100) {
                  return "Number of photos must be between 1 and 100"
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
                  Number of Photos
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => {
                      const newValue = Math.max(1, Number(field.state.value) - 1)
                      field.handleChange(newValue)
                    }}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <div className="flex justify-center items-center gap-3 px-4 min-w-6">
                    <NumberFlow
                      value={field.state.value}
                      className="text-center text-2xl! font-mono!"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    onClick={() => {
                      const newValue = Math.min(100, Number(field.state.value) + 1)
                      field.handleChange(newValue)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {field.state.meta.isTouched && field.state.meta.errors.length ? (
                  <p className="text-sm text-destructive mt-1">
                    {field.state.meta.errors.join(", ")}
                  </p>
                ) : null}
              </div>
            )}
          />

          <form.Field
            name="topicStartIndex"
            children={(field) => (
              <div className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Starting Topic
                </label>
                <Select
                  value={field.state.value.toString()}
                  onValueChange={(value) => field.handleChange(parseInt(value))}
                  disabled={topics.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        topics.length === 0 ? "No topics available" : "Select starting topic"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {topics
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((topic, index) => (
                        <SelectItem key={topic.id} value={index.toString()}>
                          {index + 1}. {topic.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {topics.length === 0
                    ? "Create topics first to set a starting topic for this class."
                    : "The topic number where this class will start from."}
                </p>
              </div>
            )}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
              Cancel
            </Button>
            <PrimaryButton type="submit" disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save changes"}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
