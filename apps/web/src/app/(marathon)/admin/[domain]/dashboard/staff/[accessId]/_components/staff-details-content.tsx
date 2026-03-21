"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Mail,
  Trash2,
  User2Icon,
  Calendar,
  Shield,
  CheckCircle,
  Pencil,
  Clock3,
} from "lucide-react"
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
  accessId: string
}

export function StaffDetailsContent({ accessId }: StaffDetailsContentProps) {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const router = useRouter()
  const trpc = useTRPC()
  const domain = useDomain()
  const queryClient = useQueryClient()

  const { data: staff } = useSuspenseQuery(
    trpc.users.getStaffAccessById.queryOptions({
      accessId,
      domain,
    }),
  )

  const { data: verificationsData } = useInfiniteQuery(
    trpc.users.getVerificationsByStaffId.infiniteQueryOptions(
      {
        staffId: staff.kind === "active" ? staff.userId : "",
        domain,
        limit: 20,
      },
      {
        enabled: staff.kind === "active",
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
      },
    ),
  )

  const totalVerifications =
    staff.kind === "active"
      ? (verificationsData?.pages.reduce((acc, page) => acc + page.items.length, 0) ?? 0)
      : 0

  const { mutate: executeRemove, isPending: isRemoving } = useMutation(
    trpc.users.deleteStaffAccess.mutationOptions({
      onError: (error) => {
        toast.error("Failed to remove staff member")
        console.error("Remove error:", error)
      },
      onSuccess: () => {
        toast.success(staff.kind === "pending" ? "Pending access removed" : "Staff member removed")
        router.push(formatDomainPathname("/admin/dashboard/staff", domain))
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.users.getStaffMembersByDomain.queryKey({ domain }),
        })
      },
    }),
  )

  const handleRemove = () => {
    executeRemove({ domain, accessId })
  }

  const memberSince = new Date(staff.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const displayName = staff.kind === "active" ? staff.user.name : staff.name
  const displayEmail = staff.kind === "active" ? staff.user.email : staff.email

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
                  <h2 className="text-xl font-medium font-gothic tracking-tight">{displayName}</h2>
                  <Badge
                    variant={staff.role === "admin" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {staff.role === "admin" ? (
                      <>
                        <Shield className="mr-1 h-3 w-3" />
                        Admin
                      </>
                    ) : (
                      "Staff"
                    )}
                  </Badge>
                  {staff.kind === "pending" ? (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                      <Clock3 className="mr-1 h-3 w-3" />
                      Pending
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    {displayEmail}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    Since {memberSince}
                  </span>
                </div>
                {staff.kind === "active" ? (
                  <div className="flex items-center gap-1.5 pt-0.5 text-[12px]">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="font-semibold tabular-nums text-foreground">
                      {totalVerifications}
                    </span>
                    <span className="text-muted-foreground">
                      {totalVerifications === 1 ? "verification" : "verifications"}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 pt-0.5 text-[12px] text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5 text-amber-600" />
                    Waiting for first login
                  </div>
                )}
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

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-8 py-6">
          {staff.kind === "active" ? <StaffAccessCard /> : null}

          {staff.kind === "active" ? (
            <section>
              <div className="mb-1 flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-brand-primary" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Activity
                </p>
              </div>
              <h3 className="font-gothic text-base font-semibold tracking-tight">
                Verification Activity
              </h3>
              <p className="mt-0.5 mb-4 text-[12px] text-muted-foreground">
                Participants verified by this staff member
              </p>

              <StaffVerificationsTable staffId={staff.userId} totalCount={totalVerifications} />
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 p-6">
              <div className="mb-1 flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-amber-500" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-700/80">
                  Pending Access
                </p>
              </div>
              <h3 className="font-gothic text-base font-semibold tracking-tight">
                Waiting for first sign-in
              </h3>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                This person has been pre-added to the marathon. Access will become active
                automatically the first time they sign in with this email address.
              </p>
            </section>
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-gothic">Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {displayName} from the staff? They will lose access
              to this marathon.
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
        accessId={accessId}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        initialData={{
          name: displayName,
          email: displayEmail,
          role: staff.role as "staff" | "admin",
        }}
      />
    </>
  )
}
