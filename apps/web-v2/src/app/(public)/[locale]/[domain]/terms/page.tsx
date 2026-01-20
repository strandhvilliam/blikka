import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"



const getTermsMarkdown = async function getTermsMarkdown(domain: string) {
  "use cache"
  const bucket = process.env.NEXT_PUBLIC_MARATHON_SETTINGS_BUCKET_NAME
  if (!bucket) return null

  const response = await fetch(`https://${bucket}.s3.eu-north-1.amazonaws.com/${domain}/terms-and-conditions.md`)

  if (!response.ok) return null

  return response.text()
}

export default async function TermsPage({ params }: PageProps<"/[locale]/[domain]/terms">) {
  const { domain } = await params
  const markdown = await getTermsMarkdown(domain)

  if (!markdown) {
    notFound()
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-rocgrotesk font-extrabold text-foreground">
        Terms and Conditions
      </h1>
      {markdown ? (
        <article className="prose prose-slate max-w-none">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </article>
      ) : (
        <p className="text-sm text-muted-foreground">
          Terms and conditions are not available right now.
        </p>
      )}
    </main>
  )
}
