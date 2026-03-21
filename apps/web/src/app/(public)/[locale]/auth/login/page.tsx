import Image from "next/image"
import { LoginForm } from "./login-form"
import { getAppSession } from "@/lib/auth/server"
import { decodeSearchParams, Page } from "@/lib/next-utils"
import { Effect, Option, Schema } from "effect"
import { redirect } from "next/navigation"
import { DotPattern } from "@/components/dot-pattern"

const _LoginPage = Effect.fn("@blikka/web/LoginPage")(
  function* ({ searchParams }: PageProps<"/[locale]/auth/login">) {
    const session = yield* getAppSession()
    const params = yield* decodeSearchParams(
      Schema.Struct({
        next: Schema.optional(Schema.String),
      }),
    )(searchParams).pipe(Effect.catch(() => Effect.succeed({ next: undefined })))

    if (Option.isSome(session)) {
      redirect(params.next ?? "/admin")
    }

    return (
      <div className="relative min-h-svh overflow-hidden">
        <DotPattern />
        <div className="pointer-events-none absolute inset-0">
          {/* <div className="absolute inset-0 bg-dot-pattern-light opacity-30" /> */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/8 via-transparent to-brand-black/4" />
          {/* <div className="absolute -top-24 left-[-10%] h-80 w-80 rounded-full bg-brand-primary/18 blur-3xl" />
          <div className="absolute -right-20 bottom-[-20%] h-96 w-96 rounded-full bg-brand-black/8 blur-3xl" /> */}
        </div>

        <div className="relative mx-auto grid min-h-svh w-full max-w-[1720px] gap-5 p-4 md:p-6 xl:grid-cols-[1.14fr_0.96fr] xl:gap-10 xl:p-10 2xl:px-14">
          <section className="relative flex overflow-hidden rounded-3xl border border-brand-black/10 bg-neutral-400 p-8 text-brand-black md:p-12 xl:p-14">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br from-neutral-300/70 via-neutral-400/85 to-neutral-500/75" />
              <div className="absolute -left-20 top-16 h-72 w-72 rounded-full bg-white/35 blur-3xl" />
              <div className="absolute right-[-8%] bottom-[-8%] h-96 w-96 rounded-full bg-neutral-900/20 blur-3xl" />
              <div
                className="absolute inset-0 opacity-20 mix-blend-soft-light"
                style={{
                  backgroundImage: "url('/noise.png')",
                  backgroundRepeat: "repeat",
                  backgroundSize: "230px 230px",
                }}
              />
            </div>

            <div className="relative flex min-h-full w-full flex-col justify-between gap-14">
              <div className="flex items-start justify-between gap-6">
                <div className="rounded-xl border border-brand-black/10 bg-brand-white/80 p-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.1)] backdrop-blur-sm">
                  <Image
                    src="/blikka-logo.svg"
                    alt="Blikka logo"
                    width={358}
                    height={299}
                    className="h-7 w-auto"
                    priority
                  />
                </div>
                <div className="rounded-full border border-brand-black/15 bg-brand-white/35 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase text-brand-black/80">
                  organizer portal
                </div>
              </div>

              <div className="max-w-2xl">
                <h1 className="font-special-gothic text-5xl leading-[0.9] tracking-tight text-balance text-brand-black md:text-7xl">
                  Welcome
                  <br />
                  back.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-brand-black/70 md:text-lg">
                  Manage entries, review submissions, and run your photo marathon from one place.
                  Sign in to continue to your organizer dashboard.
                </p>

                <div className="mt-10 grid gap-4 lg:grid-cols-[1.25fr_0.9fr]">
                  <article className="relative min-h-56 overflow-hidden rounded-3xl border border-brand-black/16 shadow-[0_14px_38px_rgba(0,0,0,0.14)]">
                    <Image
                      src="/photo-event-1.jpg"
                      alt="Event crowd at a photography marathon"
                      fill
                      sizes="(max-width: 1024px) 100vw, 45vw"
                      className="object-cover grayscale brightness-90 contrast-110"
                    />
                    <div className="absolute inset-0 bg-black/22" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/36 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                      <p className="text-[11px] text-brand-white font-medium">Easy judging flow</p>
                      <p className="mt-1 text-base font-medium text-white md:text-lg">
                        Judge submissions quickly with a focused review flow.
                      </p>
                    </div>
                  </article>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <article className="relative min-h-26 overflow-hidden rounded-2xl border border-brand-black/15 bg-brand-white/36 shadow-[0_8px_26px_rgba(0,0,0,0.1)]">
                      <Image
                        src="/photo-event-5.jpg"
                        alt="Participants and organizers during event check-in"
                        fill
                        sizes="(max-width: 1024px) 50vw, 28vw"
                        className="object-cover grayscale brightness-90 contrast-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-black/32 to-transparent" />
                      <div className="absolute inset-x-3 bottom-3">
                        <p className="text-sm font-medium text-white">
                          Seamless upload experience for all your participants.
                        </p>
                      </div>
                    </article>

                    <article className="relative min-h-26 overflow-hidden rounded-2xl border border-brand-black/15 bg-brand-white/36 px-4 py-3.5 shadow-[0_8px_26px_rgba(0,0,0,0.1)]">
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-white/72 via-brand-white/58 to-brand-white/45" />
                      <div className="relative">
                        <p className="text-[11px] text-brand-black/60">Organizer dashboard</p>
                        <p className="mt-1.5 text-sm font-medium text-brand-black/86">
                          Event-level access control and real-time submission status in one place.
                        </p>
                      </div>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center rounded-3xl border border-brand-black/10 bg-brand-white/72 p-4 shadow-[0_28px_120px_rgba(0,0,0,0.08)] backdrop-blur-xl md:p-8 xl:p-10">
            <div className="w-full max-w-lg rounded-[1.35rem] border border-brand-black/10 bg-brand-white p-7 shadow-[0_10px_40px_rgba(0,0,0,0.08)] sm:p-9">
              <LoginForm next={params.next} />
            </div>
          </section>
        </div>
      </div>
    )
  },
  Effect.catch(() => Effect.succeed(<div />)),
)

export default Page(_LoginPage)
