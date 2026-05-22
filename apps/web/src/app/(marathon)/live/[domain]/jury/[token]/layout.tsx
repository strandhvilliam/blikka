import { Suspense } from 'react'
import { JuryClientTokenProvider } from '@/components/live/jury/jury-client-token-provider'
import { Splash } from '@/components/splash'

export default function JuryTokenLayout(props: LayoutProps<'/live/[domain]/jury/[token]'>) {
  return (
    <Suspense fallback={<Splash />}>
      <JuryTokenLayoutContent {...props} />
    </Suspense>
  )
}

async function JuryTokenLayoutContent({
  children,
  params,
}: LayoutProps<'/live/[domain]/jury/[token]'>) {
  const { token } = await params
  return <JuryClientTokenProvider token={token}>{children}</JuryClientTokenProvider>
}
