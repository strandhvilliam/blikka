import Image from "next/image"
import { Page } from "@/lib/next-utils"
import { Effect } from "effect"
import { Suspense } from "react"
import { SelectDomainTitle } from "./_components/select-domain-title"
import { SelectDomainSkeleton } from "./_components/select-domain-skeleton"
import { SelectDomainList } from "./_components/select-domain-list"
import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server"
import { DotPattern } from "@/components/dot-pattern"
import { LanguageSwitcher } from "./_components/language-switcher"
import { SelectDomainLogoutButton } from "./_components/select-domain-logout-button"

const _AdminPage = Effect.fn("@blikka/web/AdminPage")(function* () {
  prefetch(trpc.marathons.getUserMarathons.queryOptions())

  return (
    <HydrateClient>
      <div className="relative min-h-svh overflow-hidden ">
        <DotPattern />

        <div className="relative mx-auto justify-center flex min-h-svh w-full max-w-xl flex-col p-6 md:p-10">
          <header className="flex items-center justify-between pb-10 pt-4 md:pt-8">
            <div className="rounded-xl border border-brand-black/10 bg-white p-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
              <Image
                src="/blikka-logo.svg"
                alt="Blikka"
                width={358}
                height={299}
                className="h-6 w-auto"
                priority
              />
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <LanguageSwitcher />
              <SelectDomainLogoutButton />
            </div>
          </header>

          <div className="flex flex-1 flex-col pb-20">
            <SelectDomainTitle />

            <div className="mt-10">
              <Suspense fallback={<SelectDomainSkeleton />}>
                <SelectDomainList />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </HydrateClient>
  )
})

export default Page(_AdminPage)
