import { decodeParams, Layout } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { prefetch, HydrateClient, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { StaffList } from "./_components/staff-list"
import { StaffListSkeleton } from "./_components/staff-list-skeleton"
import { StaffAddDialog } from "./_components/staff-add-dialog"

const _StaffLayout = Effect.fn("@blikka/web/StaffLayout")(
  function* ({ children, params }: LayoutProps<"/admin/[domain]/dashboard/staff">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)

    prefetch(
      trpc.users.getStaffMembersByDomain.queryOptions({
        domain,
      })
    )

    return (
      <HydrateClient>
        <div className="flex h-full bg-muted/30 gap-6 max-w-[1800px] mx-auto">
          <div className="w-80 bg-background flex flex-col border border-border/70 rounded-lg shadow-sm overflow-hidden">
            <div className="border-b border-border/40">
              <div className="flex items-center justify-between p-4">
                <h2 className="text-lg font-semibold font-rocgrotesk">Staff</h2>
                <StaffAddDialog />
              </div>
              <Suspense fallback={<StaffListSkeleton />}>
                <StaffList />
              </Suspense>
            </div>
          </div>
          <div className="flex-1 flex flex-col h-full bg-background border border-border/70 rounded-lg shadow-sm overflow-hidden">
            {children}
          </div>
        </div>
      </HydrateClient>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Layout(_StaffLayout)
