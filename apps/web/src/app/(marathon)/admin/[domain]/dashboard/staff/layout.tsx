import { decodeParams, Layout } from "@/lib/next-utils"
import { Effect, Schema } from "effect"
import { prefetch, HydrateClient, trpc } from "@/lib/trpc/server"
import { Suspense } from "react"
import { StaffList } from "./_components/staff-list"
import { StaffListSkeleton } from "./_components/staff-list-skeleton"
import { StaffAddDialog } from "./_components/staff-add-dialog"
import { Users } from "lucide-react"

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
        <div className="flex h-full gap-5 mx-auto max-w-[1600px] p-6">
          <div className="w-80 shrink-0 flex flex-col rounded-xl border border-border bg-white overflow-hidden">
            <div className="border-b border-border px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10">
                    <Users className="h-4 w-4 text-brand-primary" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      Team
                    </p>
                    <h1 className="text-lg font-bold tracking-tight font-gothic leading-none">Staff</h1>
                  </div>
                </div>
                <StaffAddDialog />
              </div>
            </div>
            <Suspense fallback={<StaffListSkeleton />}>
              <StaffList />
            </Suspense>
          </div>
          <div className="flex-1 flex flex-col h-full rounded-xl border border-border bg-white overflow-hidden">
            {children}
          </div>
        </div>
      </HydrateClient>
    )
  },
  Effect.catch((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Layout(_StaffLayout)
