"use client"

import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { parseAsInteger, useQueryState } from "nuqs"
import type { DeviceGroup } from "@blikka/db"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, Trash2, Camera, Smartphone, Zap } from "lucide-react"
import { useState } from "react"
import { DeviceGroupCreateDialog } from "./device-group-create-dialog"
import { DeviceGroupEditDialog } from "./device-group-edit-dialog"
import { DeviceGroupDeleteDialog } from "./device-group-delete-dialog"

function getDeviceIcon(icon: string) {
  switch (icon) {
    case "smartphone":
      return <Smartphone className="h-[18px] w-[18px]" strokeWidth={1.8} />
    case "action-camera":
      return <Zap className="h-[18px] w-[18px]" strokeWidth={1.8} />
    default:
      return <Camera className="h-[18px] w-[18px]" strokeWidth={1.8} />
  }
}

export function DeviceGroupSection() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()
  const [editDeviceGroupId, setEditDeviceGroupId] = useQueryState(
    "editDeviceGroupId",
    parseAsInteger
  )
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const { data: marathon } = useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const groups = marathon?.deviceGroups || []

  const { mutate: deleteDeviceGroup, isPending: isDeleting } = useMutation(
    trpc.deviceGroups.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Device group deleted successfully")
      },
      onError: (error) => {
        toast.error(error.message || "Something went wrong")
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
      },
    })
  )

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null)

  const handleDeleteClick = (group: DeviceGroup) => {
    setSelectedGroup(group)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = (group: DeviceGroup) => {
    deleteDeviceGroup({ domain, id: group.id })
    setDeleteDialogOpen(false)
    setSelectedGroup(null)
  }

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
        <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
          Device Groups
        </p>
      </div>
      <p className="text-[13px] text-muted-foreground leading-relaxed mb-5 max-w-lg">
        Organize participants by the type of camera or device they use. Create categories like
        smartphones, action cameras, or other devices.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.map((group) => (
          <DeviceGroupCard
            key={group.id}
            group={group}
            onDelete={() => handleDeleteClick(group)}
            onOpenEdit={() => setEditDeviceGroupId(group.id)}
            isDeleting={isDeleting}
          />
        ))}
        <button
          type="button"
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 py-8 text-muted-foreground/60 transition-colors hover:border-border hover:bg-muted/30 hover:text-muted-foreground cursor-pointer"
        >
          <Plus className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-[13px] font-medium">Add Device Group</span>
        </button>
        <DeviceGroupCreateDialog isOpen={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
        <DeviceGroupEditDialog
          deviceGroupId={editDeviceGroupId}
          isOpen={!!editDeviceGroupId}
          onOpenChange={() => setEditDeviceGroupId(null)}
        />
        <DeviceGroupDeleteDialog
          group={selectedGroup}
          isOpen={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </section>
  )
}

function DeviceGroupCard({
  group,
  onDelete,
  isDeleting,
  onOpenEdit,
}: {
  group: DeviceGroup
  onDelete: () => void
  isDeleting: boolean
  onOpenEdit: () => void
}) {
  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-border bg-white transition-shadow duration-200 hover:border-border/80 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground/60">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center justify-center">{getDeviceIcon(group.icon)}</span>
            </TooltipTrigger>
            <TooltipContent>Device type: {group.icon}</TooltipContent>
          </Tooltip>
        </div>
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{group.name}</h3>
          {group.description && (
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
              {group.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center px-4 pb-4 gap-1.5">
        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={onOpenEdit}>
          Edit
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label="Delete device group"
          className="h-8 w-8"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
