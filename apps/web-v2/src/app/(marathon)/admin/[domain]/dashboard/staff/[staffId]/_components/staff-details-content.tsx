"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Mail, Trash2, User2Icon, Calendar, Shield, CheckCircle, Pencil } from "lucide-react"
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
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  useInfiniteQuery,
} from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { formatDomainPathname } from "@/lib/utils"
import { StaffVerificationsTable } from "./staff-verifications-table"
import { StaffEditDialog } from "./staff-edit-dialog"

interface StaffDetailsContentProps {
  staffId: string
}

export function StaffDetailsContent({ staffId }: StaffDetailsContentProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
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

  const { data: verificationsData } = useInfiniteQuery(
    trpc.users.getVerificationsByStaffId.infiniteQueryOptions(
      {
        staffId,
        domain,
        limit: 20,
      },
      {
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
      }
    )
  )

  const totalVerifications =
    verificationsData?.pages.reduce((acc, page) => {
      return acc + page.items.length
    }, 0) ?? 0

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

  const memberSince = new Date(staff.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <>
      <div className="border-b border-border/40 bg-background">
        <div className="px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-muted">
                  <User2Icon className="h-7 w-7 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold font-gothic">{staff.user.name}</h2>
                  <Badge
                    variant={staff.role === "admin" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {staff.role === "admin" ? (
                      <>
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </>
                    ) : (
                      "Staff"
                    )}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    {staff.user.email}
                  </div>
                  <div className="flex items-center">
                    <Calendar className="mr-1.5 h-3.5 w-3.5" />
                    Member since {memberSince}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{totalVerifications}</span>
                    <span className="text-muted-foreground">
                      {totalVerifications === 1 ? "verification" : "verifications"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditDialogOpen(true)}
                className="gap-2"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
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
      </div>

      <ScrollArea className="flex-1 bg-muted/30">
        <div className=" space-y-4 p-6">
          <div className=" pt-4">
            <h3 className="text-lg font-semibold font-gothic">Verification Activity</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Participants verified by this staff member
            </p>
          </div>

          <StaffVerificationsTable staffId={staffId} totalCount={totalVerifications} />
        </div>
      </ScrollArea>

      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-gothic">Remove Staff Member</AlertDialogTitle>
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

      <StaffEditDialog
        staffId={staffId}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        initialData={{
          name: staff.user.name,
          email: staff.user.email,
          role: staff.role as "staff" | "admin",
        }}
      />
    </>
  )
}
