import { DomainProvider } from "@/lib/domain-provider"

export default async function DomainLiveLayout({ children, params }: LayoutProps<"/live/[domain]">) {
  const { domain } = await params
  return <DomainProvider domain={domain}>{children}</DomainProvider>
}
