import { FadeIn } from "./fade-in"

export function LogoStrip() {
  return (
    <section className="border-y border-border bg-card py-10 px-6 lg:px-12">
      <FadeIn>
        <p className="text-center text-xl text-muted-foreground leading-relaxed">
          Used by{" "}
          <span className="font-semibold text-foreground">
            Stockholm Fotomarathon
          </span>
          {" & "}
          <span className="font-semibold text-foreground">
            Sthlm by Camera
          </span>{" "}
          to run their events
        </p>
      </FadeIn>
    </section>
  )
}
