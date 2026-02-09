
export default async function HomePage() {

  console.log("ENV", process.env.NODE_ENV)
  console.log("NEXT_PUBLIC_ENV", process.env.NEXT_PUBLIC_ENV)
  console.log("AUTH_URL", process.env.BETTER_AUTH_URL)
  console.log("BLIKKA_PRODUCTION_URL", process.env.BLIKKA_PRODUCTION_URL)

  return (
    <div>
      <h1>Home</h1>
    </div>
  )
} 