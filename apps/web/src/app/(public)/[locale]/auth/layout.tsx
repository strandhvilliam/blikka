export default async function AuthLayout({
  children,
}: LayoutProps<"/[locale]/auth">) {
  return <>{children}</>
}
