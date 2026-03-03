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
import { PrimaryButton } from "@/components/ui/primary-button"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useEffect } from "react"
import { Camera, Smartphone, Zap, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DeviceGroup } from "@blikka/db"

const deviceIcons = [
  {
    value: "camera",
    icon: Camera,
    label: "Camera",
  },
  {
    value: "smartphone",
    icon: Smartphone,
    label: "Smartphone",
  },
  {
    value: "action-camera",
    icon: Zap,
    label: "Action Camera",
  },
] as const

interface EditDeviceGroupDialogProps {
  deviceGroupId: number | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function DeviceGroupEditDialog({
  deviceGroupId,
  isOpen,
  onOpenChange,
}: EditDeviceGroupDialogProps) {
  const domain = useDomain()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const groups = marathon?.deviceGroups || []
  const deviceGroup = deviceGroupId ? groups.find((g) => g.id === deviceGroupId) : null

  const { mutate: updateDeviceGroup, isPending: isUpdating } = useMutation(
    trpc.deviceGroups.update.mutationOptions({
      onError: (error) => {
        toast.error("Failed to update device group", {
          description: error.message,
        })
      },
      onSuccess: () => {
        toast.success("Device group updated")
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
      name: deviceGroup?.name || "",
      description: deviceGroup?.description || "",
      icon: (deviceGroup?.icon || "camera") as "camera" | "smartphone" | "action-camera",
    },
    onSubmit: async ({ value }) => {
      if (!deviceGroupId) return

      updateDeviceGroup({
        domain,
        id: deviceGroupId,
        data: {
          name: value.name,
          description: value.description || undefined,
          icon: value.icon,
        },
      })
    },
  })

  useEffect(() => {
    if (deviceGroup) {
      form.setFieldValue("name", deviceGroup.name)
      form.setFieldValue("description", deviceGroup.description || "")
      form.setFieldValue(
        "icon",
        (deviceGroup.icon || "camera") as "camera" | "smartphone" | "action-camera"
      )
    }
  }, [deviceGroup, form])

  if (!deviceGroup) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Device Group</DialogTitle>
          <DialogDescription>
            Modify the device group details. These changes will be reflected immediately.
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
                  placeholder="Professional Cameras"
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
                  placeholder="DSLR and Mirrorless cameras"
                />
              </div>
            )}
          />

          <form.Field
            name="icon"
            children={(field) => (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Device Icon
                </label>
                <div className="flex gap-3">
                  {deviceIcons.map((type) => (
                    <Button
                      key={type.value}
                      type="button"
                      variant="outline"
                      className={cn(
                        "flex-1 h-fit aspect-square p-0 relative overflow-hidden flex flex-col items-center justify-center gap-2",
                        field.state.value === type.value && "ring-2 ring-primary ring-offset-2"
                      )}
                      onClick={() => field.handleChange(type.value)}
                    >
                      <type.icon className="h-8 w-8" />
                      <span className="text-xs">{type.label}</span>
                      {field.state.value === type.value && (
                        <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Select the icon for the device group.
                </p>
              </div>
            )}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} type="button" size="sm">
              Cancel
            </Button>
            <PrimaryButton className="py-1" type="submit" disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save changes"}
            </PrimaryButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
