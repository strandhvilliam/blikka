import { cacheLife, cacheTag } from "next/cache"
import { Config, Effect, Exit, Option } from "effect"
import { format } from "date-fns"
import ReactMarkdown from "react-markdown"
import { Database } from "@blikka/db"



const getTermsMarkdown = async function getTermsMarkdown(domain: string) {
  "use cache"
  cacheTag(`terms-${domain}`)
  cacheLife("days")

  const result = await Effect.runPromiseExit(Effect.gen(function* () {
    const bucket = yield* Config.string("NEXT_PUBLIC_MARATHON_SETTINGS_BUCKET_NAME")
    if (!bucket) return yield* Effect.fail(new Error("Bucket not found"))

    const response = yield* Effect.tryPromise({
      try: () => fetch(`https://${bucket}.s3.eu-north-1.amazonaws.com/${domain}/terms-and-conditions.txt`),
      catch: (error) => new Error(`Fetch failed: ${error}`),
    })

    if (!response.ok) return yield* Effect.fail(new Error(`Response result was not ok. ${response.status}`))

    return yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (error) => new Error(`Failed to read response text: ${error}`),
    })
  }))

  if (Exit.isFailure(result)) {
    console.error("Error fetching terms and conditions", result.cause)
    return null
  }

  return result.value
}

const getPublicMarathon = async function getPublicMarathon(domain: string) {
  "use cache"
  cacheTag(`public-marathon-${domain}`)
  cacheLife("days")

  const result = await Effect.runPromiseExit(Effect.gen(function* () {
    const db = yield* Database
    const marathon = yield* db.marathonsQueries.getMarathonByDomain({ domain })

    return yield* Option.match(marathon, {
      onSome: (m) => Effect.succeed(m),
      onNone: () => Effect.fail(new Error("Marathon not found")),
    })
  }).pipe(Effect.provide(Database.layer)))

  if (Exit.isFailure(result)) {
    console.error("Error fetching public marathon", result.cause)
    return null
  }
  return result.value
}


export default async function TermsPage({ params }: PageProps<"/[locale]/[domain]/terms">) {
  const { domain } = await params
  const publicMarathon = await getPublicMarathon(domain)
  const markdown = await getTermsMarkdown(domain)

  const marathonName = publicMarathon?.name ?? "Photomarathon"
  const marathonDate = publicMarathon?.startDate
    ? format(new Date(publicMarathon.startDate), "d MMMM yyyy")
    : null


  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="mb-10 flex flex-col gap-6 rounded-3xl border border-border bg-card px-6 py-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-lg font-semibold text-muted-foreground">
            {publicMarathon?.logoUrl ? (
              <img
                src={publicMarathon.logoUrl}
                alt={`${marathonName} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              marathonName.slice(0, 1)
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Photomarathon
            </p>
            <h1 className="text-3xl font-rocgrotesk font-extrabold text-foreground">
              {marathonName}
            </h1>
            {marathonDate ? (
              <p className="text-sm font-medium text-muted-foreground">{marathonDate}</p>
            ) : null}

          </div>
        </div>
      </header>
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Legal
        </p>
        <h2 className="text-2xl font-rocgrotesk font-extrabold text-foreground">
          Terms and Conditions
        </h2>
      </div>
      {markdown ? (
        <article className="prose prose-slate max-w-none leading-relaxed">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-2xl font-rocgrotesk font-bold">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-rocgrotesk font-semibold">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-rocgrotesk font-semibold">{children}</h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-base font-rocgrotesk font-semibold">{children}</h4>
              ),
              p: ({ children }) => <p className="text-sm">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              a: ({ children, href }) => (
                <a href={href} className="font-medium text-primary underline-offset-4 hover:underline">
                  {children}
                </a>
              ),
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-border pl-4 text-sm text-muted-foreground">
                  {children}
                </blockquote>
              ),
            }}
          >
            {markdown}
          </ReactMarkdown>
        </article>
      ) : (
        <p className="text-sm text-muted-foreground">
          Terms and conditions are not available right now.
        </p>
      )}
    </main>
  )
}
