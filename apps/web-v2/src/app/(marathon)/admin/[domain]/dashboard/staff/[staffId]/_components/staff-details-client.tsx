"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Mail, Trash2, User2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { formatDomainPathname } from "@/lib/utils"

interface StaffDetailsClientProps {
  staffId: string
}

export function StaffDetailsClient({ staffId }: StaffDetailsClientProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const router = useRouter()
  const trpc = useTRPC()
  const domain = useDomain()
  const queryClient = useQueryClient()

  const { data: staff } = useSuspenseQuery(
    trpc.users.getStaffMemberById.queryOptions({
      staffId,
      domain,
    })
  )

  const { mutate: executeRemove, isPending: isRemoving } = useMutation(
    trpc.users.deleteUserMarathonRelation.mutationOptions({
      onError: (error) => {
        toast.error("Failed to remove staff member")
        console.error("Remove error:", error)
      },
      onSuccess: () => {
        toast.success("Staff member removed successfully")
        router.push(formatDomainPathname("/admin/dashboard/staff", domain))
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.users.getStaffMembersByDomain.queryKey({ domain }),
        })
      },
    })
  )

  const handleRemove = () => {
    executeRemove({ domain, userId: staffId })
  }

  if (!staff) {
    return <div>Staff member not found</div>
  }

  return (
    <>
      <div className="border-b border-border/40 bg-background">
        <div className="px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-muted">
                  <User2Icon className="h-6 w-6 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold font-rocgrotesk">{staff.user.name}</h2>
                  <Badge
                    variant={staff.role === "admin" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {staff.role.charAt(0).toUpperCase() + staff.role.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="mr-2 h-3.5 w-3.5" />
                  {staff.user.email}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsRemoveDialogOpen(true)}
              className="gap-2"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-muted/30">
        <div className="p-8 space-y-6">
          <div className="bg-background rounded-lg border border-border/40 shadow-sm">
            <div className="px-6 py-4 border-b border-border/40">
              <h3 className="text-base font-semibold font-rocgrotesk">Staff Information</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Name
                  </span>
                  <p className="text-sm mt-1">{staff.user.name}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Email
                  </span>
                  <p className="text-sm mt-1">{staff.user.email}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Role
                  </span>
                  <p className="text-sm mt-1 capitalize">{staff.role}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-rocgrotesk">Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {staff.user.name} from the staff? This action cannot
              be undone and they will lose access to this marathon.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? "Removing..." : "Remove Staff Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
