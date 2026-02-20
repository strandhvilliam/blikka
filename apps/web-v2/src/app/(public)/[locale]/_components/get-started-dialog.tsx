"use client"

import { useState, useTransition } from "react"
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Users,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getStartedAction } from "./get-started-action"

export function GetStartedDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const input = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      organization: formData.get("organization") as string,
      eventType: formData.get("eventType") as string,
      estimatedParticipants: formData.get("estimatedParticipants") as string,
      message: formData.get("message") as string,
    }

    startTransition(async () => {
      const result = await getStartedAction(input)
      if (result.error) {
        setError("Something went wrong. Please try again or email us directly.")
      } else {
        setSubmitted(true)
      }
    })
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setTimeout(() => {
        setSubmitted(false)
        setError(null)
      }, 300)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto border-brand-black/8 bg-brand-white p-0 shadow-2xl sm:max-w-3xl lg:max-w-4xl">
        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-5 px-8 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary/10">
              <CheckCircle2 className="h-7 w-7 text-brand-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl text-brand-black">
                We will be in touch!
              </DialogTitle>
              <DialogDescription className="mx-auto mt-3 max-w-md text-base text-brand-black/50">
                Thanks for reaching out. We typically respond within one
                business day with a tailored walkthrough and pricing.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="mt-4 rounded-full bg-brand-black px-8 py-3 text-sm font-semibold text-brand-white transition-colors hover:bg-brand-black/85"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-5">
            {/* Left panel — context & benefits */}
            <div className="hidden border-r border-brand-black/6 bg-[#fafaf8] px-8 py-10 lg:col-span-2 lg:block">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-primary">
                Book a demo
              </p>
              <h3 className="mt-3 text-xl leading-snug font-semibold text-brand-black text-pretty">
                Let us set up your first event together
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-black/50">
                Fill in the form and we will schedule a 20-minute call to walk
                through the platform, map your setup, and share a clear quote.
              </p>

              <ul className="mt-8 grid gap-4 text-sm text-brand-black/70">
                <li className="flex items-start gap-3">
                  <Clock3
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-medium text-brand-black">
                      Live walkthrough
                    </span>
                    <br />
                    See the full participant and organizer flow
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CalendarDays
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-medium text-brand-black">
                      Rollout plan
                    </span>
                    <br />
                    A suggested timeline for your launch
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Users
                    className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-medium text-brand-black">
                      Custom pricing
                    </span>
                    <br />
                    Matched to your event size and format
                  </span>
                </li>
              </ul>

              <div className="mt-10 rounded-xl border border-brand-black/6 bg-brand-white px-5 py-4">
                <p className="text-xs font-medium text-brand-black/40">
                  Average response time
                </p>
                <p className="mt-1 text-lg font-semibold text-brand-black">
                  One week
                </p>
              </div>
            </div>

            {/* Right panel — form */}
            <div className="px-6 py-8 sm:px-8 sm:py-10 lg:col-span-3">
              <DialogHeader className="lg:text-left">
                <DialogTitle className="text-2xl text-brand-black">
                  Tell us about your event
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-brand-black/45">
                  We will get back to you with a walkthrough and pricing
                  tailored to your needs.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="mt-8 grid gap-6">
                {/* Name & Email */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <fieldset className="grid gap-2">
                    <Label htmlFor="gs-name" className="text-brand-black">
                      Full name
                    </Label>
                    <Input
                      id="gs-name"
                      name="name"
                      required
                      autoComplete="name"
                      placeholder="Jane Andersson"
                      className="h-11 border-brand-black/12 bg-brand-white text-brand-black placeholder:text-brand-black/25 focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
                    />
                    <p className="text-xs text-brand-black/35">
                      So we know what to call you!
                    </p>
                  </fieldset>
                  <fieldset className="grid gap-2">
                    <Label htmlFor="gs-email" className="text-brand-black">
                      Work email
                    </Label>
                    <Input
                      id="gs-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="jane@organization.com"
                      className="h-11 border-brand-black/12 bg-brand-white text-brand-black placeholder:text-brand-black/25 focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
                    />
                    <p className="text-xs text-brand-black/35">
                      We will send the meeting invite here.
                    </p>
                  </fieldset>
                </div>

                {/* Organization */}
                <fieldset className="grid gap-2">
                  <Label
                    htmlFor="gs-organization"
                    className="text-brand-black"
                  >
                    Organization
                  </Label>
                  <Input
                    id="gs-organization"
                    name="organization"
                    required
                    autoComplete="organization"
                    placeholder="Stockholm Photography Club"
                    className="h-11 border-brand-black/12 bg-brand-white text-brand-black placeholder:text-brand-black/25 focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
                  />
                  <p className="text-xs text-brand-black/35">
                    The company, association, or school organizing the event.
                  </p>
                </fieldset>

                {/* Event type & Participants */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <fieldset className="grid gap-2">
                    <Label className="text-brand-black">Event type</Label>
                    <Select name="eventType" required>
                      <SelectTrigger className="h-11 w-full border-brand-black/12 bg-brand-white text-brand-black data-placeholder:text-brand-black/25">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="photo-competition">
                          Photo competition
                        </SelectItem>
                        <SelectItem value="corporate-event">
                          Corporate event
                        </SelectItem>
                        <SelectItem value="school-education">
                          School / Education
                        </SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-brand-black/35">
                      Helps us prepare the right demo flow for you.
                    </p>
                  </fieldset>
                  <fieldset className="grid gap-2">
                    <Label className="text-brand-black">
                      Expected participants
                    </Label>
                    <Select name="estimatedParticipants" required>
                      <SelectTrigger className="h-11 w-full border-brand-black/12 bg-brand-white text-brand-black data-placeholder:text-brand-black/25">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-50">1 – 50</SelectItem>
                        <SelectItem value="51-150">51 – 150</SelectItem>
                        <SelectItem value="151-500">151 – 500</SelectItem>
                        <SelectItem value="500+">500+</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-brand-black/35">
                      A rough estimate is fine — pricing scales with size.
                    </p>
                  </fieldset>
                </div>

                {/* Message */}
                <fieldset className="grid gap-2">
                  <Label htmlFor="gs-message" className="text-brand-black">
                    Anything else?{" "}
                    <span className="font-normal text-brand-black/35">
                      Optional
                    </span>
                  </Label>
                  <Textarea
                    id="gs-message"
                    name="message"
                    rows={4}
                    placeholder="Tell us about your event goals, timeline, specific questions…"
                    className="border-brand-black/12 bg-brand-white text-brand-black placeholder:text-brand-black/25 focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
                  />
                </fieldset>

                {error ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </p>
                ) : null}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="order-2 text-xs text-brand-black/30 sm:order-1">
                    We will never share your information.
                  </p>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="group order-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand-black px-8 py-3.5 text-sm font-semibold text-brand-white transition-[background-color,gap] duration-200 hover:gap-3 hover:bg-brand-black/85 disabled:opacity-50 sm:order-2"
                  >
                    {isPending ? (
                      <>
                        <div className="animate-spin">
                          <Loader2 className="h-4 w-4" />
                        </div>
                        Sending…
                      </>
                    ) : (
                      <>
                        Send request
                        <ArrowRight
                          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
