import { Page } from "@/lib/next-utils"
import { Effect } from "effect"
import { Suspense } from "react"
import { SelectDomainTitle } from "./_components/select-domain-title"
import { SelectDomainSkeleton } from "./_components/select-domain-skeleton"
import { SelectDomainList } from "./_components/select-domain-list"
import { LanguageSwitcher } from "./_components/language-switcher"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"

const _AdminPage = Effect.fn("@blikka/web/AdminPage")(function* () {
  prefetch(trpc.marathons.getUserMarathons.queryOptions())

  return (
    <HydrateClient>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden flex-col gap-4">
        <div className="absolute top-4 right-4 z-20">
          <LanguageSwitcher />
        </div>
        <SelectDomainTitle />
        <div className="w-full max-w-md relative z-10 mt-4 min-h-[500px]">
          <Suspense fallback={<SelectDomainSkeleton />}>
            <SelectDomainList />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  )
})

export default Page(_AdminPage)
