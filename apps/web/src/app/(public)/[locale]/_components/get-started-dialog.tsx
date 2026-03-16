"use client"

/* eslint-disable react/no-children-prop -- TanStack Form Field/Subscribe require children prop to avoid parser conflict with HTML form element */
import { useState } from "react"
import { useForm } from "@tanstack/react-form"
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

const eventTypes = [
  { value: "photo-competition", label: "Photo competition" },
  { value: "corporate-event", label: "Corporate event" },
  { value: "school-education", label: "School / Education" },
  { value: "other", label: "Other" },
] as const

const participantRanges = [
  { value: "1-50", label: "1 – 50" },
  { value: "51-150", label: "51 – 150" },
  { value: "151-500", label: "151 – 500" },
  { value: "500+", label: "500+" },
] as const

export function GetStartedDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      organization: "",
      website: "",
      eventType: "",
      estimatedParticipants: "",
      message: "",
    },
    onSubmit: async ({ value }) => {
      setError(null)
      const result = await getStartedAction({
        name: value.name,
        email: value.email,
        organization: value.organization,
        website: value.website || undefined,
        eventType: value.eventType,
        estimatedParticipants: value.estimatedParticipants,
        message: value.message,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSubmitted(true)
      }
    },
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setTimeout(() => {
        setSubmitted(false)
        setError(null)
        form.reset()
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

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  form.handleSubmit()
                }}
                className="mt-8 grid gap-6"
              >
                {/* Name & Email */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <form.Field
                    name="name"
                    validators={{
                      onChange: ({ value }) =>
                        !value ? "Full name is required" : undefined,
                    }}
                    children={(field) => (
                      <fieldset className="grid gap-2">
                        <Label className="text-brand-black">Full name</Label>
                        <Input
                          id="gs-name"
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          autoComplete="name"
                          placeholder="Jane Andersson"
                          className="h-11 border-brand-black/12 bg-brand-white text-brand-black placeholder:text-brand-black/25 focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
                        />
                        {field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0 && (
                            <p className="text-xs text-red-600">
                              {field.state.meta.errors.join(", ")}
                            </p>
                          )}
                        <p className="text-xs text-brand-black/35">
                          So we know what to call you!
                        </p>
                      </fieldset>
                    )}
                  />
                  <form.Field
                    name="email"
                    validators={{
                      onChange: ({ value }) => {
                        if (!value) return "Work email is required"
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                          return "Invalid email address"
                        }
                        return undefined
                      },
                    }}
                    children={(field) => (
                      <fieldset className="grid gap-2">
                        <Label className="text-brand-black">Work email</Label>
                        <Input
                          id="gs-email"
                          name={field.name}
                          type="email"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                          autoComplete="email"
                          placeholder="jane@organization.com"
                          className="h-11 border-brand-black/12 bg-brand-white text-brand-black placeholder:text-brand-black/25 focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
                        />
                        {field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0 && (
                            <p className="text-xs text-red-600">
                              {field.state.meta.errors.join(", ")}
                            </p>
                          )}
                        <p className="text-xs text-brand-black/35">
                          We will send the meeting invite here.
                        </p>
                      </fieldset>
                    )}
                  />
                </div>

                {/* Organization */}
                <form.Field
                  name="organization"
                  validators={{
                    onChange: ({ value }) =>
                      !value ? "Organization is required" : undefined,
                  }}
                  children={(field) => (
                    <fieldset className="grid gap-2">
                      <Label className="text-brand-black">Organization</Label>
                      <Input
                        id="gs-organization"
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        autoComplete="organization"
                        placeholder="Stockholm Photography Club"
                        className="h-11 border-brand-black/12 bg-brand-white text-brand-black placeholder:text-brand-black/25 focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
                      />
                      {field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0 && (
                          <p className="text-xs text-red-600">
                            {field.state.meta.errors.join(", ")}
                          </p>
                        )}
                      <p className="text-xs text-brand-black/35">
                        The company, association, or school organizing the event.
                      </p>
                    </fieldset>
                  )}
                />

                {/* Website */}
                <form.Field
                  name="website"
                  children={(field) => (
                    <fieldset className="grid gap-2">
                      <Label className="text-brand-black">
                        Website{" "}
                        <span className="font-normal text-brand-black/35">
                          Optional
                        </span>
                      </Label>
                      <Input
                        id="gs-website"
                        name={field.name}
                        type="url"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        autoComplete="url"
                        placeholder="https://example.com"
                        className="h-11 border-brand-black/12 bg-brand-white text-brand-black placeholder:text-brand-black/25 focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
                      />
                    </fieldset>
                  )}
                />

                {/* Event type & Participants */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <form.Field
                    name="eventType"
                    validators={{
                      onChange: ({ value }) =>
                        !value ? "Event type is required" : undefined,
                    }}
                    children={(field) => (
                      <fieldset className="grid gap-2">
                        <Label className="text-brand-black">Event type</Label>
                        <Select
                          value={field.state.value}
                          onValueChange={(value) => field.handleChange(() => value)}
                        >
                          <SelectTrigger className="h-11 w-full border-brand-black/12 bg-brand-white text-brand-black data-placeholder:text-brand-black/25">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {eventTypes.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0 && (
                            <p className="text-xs text-red-600">
                              {field.state.meta.errors.join(", ")}
                            </p>
                          )}
                        <p className="text-xs text-brand-black/35">
                          Helps us prepare the right demo flow for you.
                        </p>
                      </fieldset>
                    )}
                  />
                  <form.Field
                    name="estimatedParticipants"
                    validators={{
                      onChange: ({ value }) =>
                        !value ? "Expected participants is required" : undefined,
                    }}
                    children={(field) => (
                      <fieldset className="grid gap-2">
                        <Label className="text-brand-black">
                          Expected participants
                        </Label>
                        <Select
                          value={field.state.value}
                          onValueChange={(value) => field.handleChange(() => value)}
                        >
                          <SelectTrigger className="h-11 w-full border-brand-black/12 bg-brand-white text-brand-black data-placeholder:text-brand-black/25">
                            <SelectValue placeholder="Select range" />
                          </SelectTrigger>
                          <SelectContent>
                            {participantRanges.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.state.meta.isTouched &&
                          field.state.meta.errors.length > 0 && (
                            <p className="text-xs text-red-600">
                              {field.state.meta.errors.join(", ")}
                            </p>
                          )}
                        <p className="text-xs text-brand-black/35">
                          A rough estimate is fine — pricing scales with size.
                        </p>
                      </fieldset>
                    )}
                  />
                </div>

                {/* Message */}
                <form.Field
                  name="message"
                  children={(field) => (
                    <fieldset className="grid gap-2">
                      <Label className="text-brand-black">
                        Anything else?{" "}
                        <span className="font-normal text-brand-black/35">
                          Optional
                        </span>
                      </Label>
                      <Textarea
                        id="gs-message"
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        rows={4}
                        placeholder="Tell us about your event goals, timeline, specific questions…"
                        className="border-brand-black/12 bg-brand-white text-brand-black placeholder:text-brand-black/25 focus-visible:border-brand-primary focus-visible:ring-brand-primary/20"
                      />
                    </fieldset>
                  )}
                />

                {error ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </p>
                ) : null}

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="order-2 text-xs text-brand-black/30 sm:order-1">
                    We will never share your information.
                  </p>
                  <form.Subscribe
                    selector={(state) => [state.isSubmitting, state.canSubmit]}
                    children={([isSubmitting, canSubmit]) => (
                      <button
                        type="submit"
                        disabled={isSubmitting || !canSubmit}
                        className="group order-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand-black px-8 py-3.5 text-sm font-semibold text-brand-white transition-[background-color,gap] duration-200 hover:gap-3 hover:bg-brand-black/85 disabled:opacity-50 sm:order-2"
                      >
                        {isSubmitting ? (
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
                    )}
                  />
                </div>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
