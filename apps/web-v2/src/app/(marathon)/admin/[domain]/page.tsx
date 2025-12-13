import Link from "next/link"
import { rootDomain, protocol } from "@/config"
import { Effect, Schema } from "effect"
import { decodeParams } from "@/lib/next-utils"
import { Page } from "@/lib/next-utils"
import { getTranslations } from "@/lib/server-utils"

const _SubdomainPage = Effect.fn("@blikka/web/SubdomainPage")(
  function* ({ params }: PageProps<"/admin/[domain]">) {
    const { domain } = yield* decodeParams(Schema.Struct({ domain: Schema.String }))(params)
    const t = yield* getTranslations("DomainPage")

    return (
      <div className="flex min-h-screen flex-col p-4">
        <div className="absolute top-4 right-4">
          <Link
            href={`${protocol}://${rootDomain}`}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {rootDomain}
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Welcome to {domain}.{rootDomain}
            </h1>
            <p className="mt-3 text-lg text-gray-600">{t("welcome")}</p>
          </div>
        </div>
      </div>
    )
  },
  Effect.catchAll((error) => Effect.succeed(<div>Error: {error.message}</div>))
)

export default Page(_SubdomainPage)
