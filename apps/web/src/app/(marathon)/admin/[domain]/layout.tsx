import { DomainProvider } from "@/lib/domain-provider"

export default async function DomainAdminLayout({ children, params }: LayoutProps<"/admin/[domain]">) {
  const { domain } = await params
  return <DomainProvider domain={domain}>{children}</DomainProvider>
}
