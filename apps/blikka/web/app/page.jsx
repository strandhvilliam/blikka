// Render per request: the API_INTERNAL_URL binding exists at runtime only, not during the build.
export const dynamic = 'force-dynamic'

export default async function Page() {
  const res = await fetch(`${process.env.API_INTERNAL_URL}/api/ping`, { method: 'POST' })
  return (
    <pre>
      {res.status} {await res.text()}
    </pre>
  )
}
