"use client"

import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { parseAsInteger, useQueryState } from "nuqs"
import type { DeviceGroup } from "@blikka/db"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, Trash2, Camera, Smartphone, Zap } from "lucide-react"
import { useState } from "react"
import { DeviceGroupCreateDialog } from "./device-group-create-dialog"
import { DeviceGroupEditDialog } from "./device-group-edit-dialog"
import { DeviceGroupDeleteDialog } from "./device-group-delete-dialog"

function getDeviceIcon(icon: string) {
  switch (icon) {
    case "smartphone":
      return <Smartphone className="h-6 w-6" />
    case "action-camera":
      return <Zap className="h-6 w-6" />
    default:
      return <Camera className="h-6 w-6" />
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
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold font-rocgrotesk">Device Groups</h2>
      </div>
      <p className="text-sm text-muted-foreground pb-4">
        Here you can add, edit, or remove device groups for the marathon. Each group helps you
        organize participants by the type of camera or device they use. Use this section to create
        categories like smartphones, action cameras, or other devices for your event.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {groups.map((group) => (
          <DeviceGroupCard
            key={group.id}
            group={group}
            onDelete={() => handleDeleteClick(group)}
            onOpenEdit={() => setEditDeviceGroupId(group.id)}
            isDeleting={isDeleting}
          />
        ))}
        <Card className="flex items-center justify-center bg-muted/50">
          <Button
            variant="ghost"
            className="w-full transition duration-200 h-full flex flex-col items-center justify-center py-10 text-muted-foreground"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="size-5" />
            <span>Add Device Group</span>
          </Button>
        </Card>
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
    <Card key={group.id} className="relative justify-between flex flex-col">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex h-fit items-center w-fit justify-center bg-muted rounded-lg shadow-sm border p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center justify-center">{getDeviceIcon(group.icon)}</span>
            </TooltipTrigger>
            <TooltipContent>Device type: {group.icon}</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-col justify-between">
          <h3 className="text-lg font-semibold">{group.name}</h3>
          <p className="text-sm text-muted-foreground">{group.description}</p>
        </div>
      </div>
      <div className="flex items-center px-4 pb-4 gap-2">
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
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  )
}
