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
import { StaffAccessCard } from "../../_components/staff-access-card"

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
      <div className="border-b border-border bg-white">
        <div className="px-8 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 ring-2 ring-brand-primary/10 ring-offset-2 ring-offset-white">
                <AvatarFallback className="bg-muted/60 text-muted-foreground">
                  <User2Icon className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold font-gothic tracking-tight">{staff.user.name}</h2>
                  <Badge
                    variant={staff.role === "admin" ? "default" : "secondary"}
                    className="text-[10px]"
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
                <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    {staff.user.email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Since {memberSince}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] pt-0.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-semibold tabular-nums text-foreground">{totalVerifications}</span>
                  <span className="text-muted-foreground">
                    {totalVerifications === 1 ? "verification" : "verifications"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditDialogOpen(true)}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsRemoveDialogOpen(true)}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-6 px-8 py-6">
          <StaffAccessCard />

          <section>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-1 w-1 rounded-full bg-brand-primary" />
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Activity
              </p>
            </div>
            <h3 className="text-base font-semibold font-gothic tracking-tight">Verification Activity</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5 mb-4">
              Participants verified by this staff member
            </p>

            <StaffVerificationsTable staffId={staffId} totalCount={totalVerifications} />
          </section>
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
