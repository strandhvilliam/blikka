import { getAppSession } from "@/lib/auth/server"
import { getDefaultPostLoginPath } from "@/lib/auth/redirect"
import { getPermissions } from "@blikka/api/trpc/utils"
import { VerifyForm } from "./verify-form"
import { redirect } from "next/navigation"
import { serverRuntime } from "@/lib/server-runtime"

export default async function VerifyPage({
  searchParams,
}: PageProps<"/[locale]/auth/verify">) {
  const session = await getAppSession()
  const params = await searchParams
  const email = typeof params.email === "string" ? params.email : undefined
  const next = typeof params.next === "string" ? params.next : undefined

  if (session) {
    const permissions = await serverRuntime.runPromise(
      getPermissions({ userId: session.user.id }),
    )
    redirect(next ?? getDefaultPostLoginPath(permissions))
  }

  if (!email) {
    redirect("/auth/login?error=email_required")
  }

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <VerifyForm email={email} next={next} />
      </div>
    </div>
  )}
