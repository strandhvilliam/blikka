import { JuryClientTokenProvider } from "@/components/live/jury/jury-client-token-provider"

export default async function JuryTokenLayout({ children, params }: LayoutProps<"/live/[domain]/jury/[token]">) {
  const { token } = await params
  return (
    <JuryClientTokenProvider token={token}>{children}</JuryClientTokenProvider>
  )
}
