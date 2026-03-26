"use client"

import React, { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Check,
  Globe,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  Info,
} from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { TimePickerInput } from "@/components/ui/time-picker"
import { toast } from "sonner"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useForm } from "@tanstack/react-form"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { useDomain } from "@/lib/domain-provider"
import {
  useQueryClient,
  useSuspenseQuery,
  useMutation,
} from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { LogoUploadField } from "./logo-upload-field"
import { DateDurationSummary } from "./date-duration-summary"
import { DangerZoneSection } from "./danger-zone-tab"
import { SettingsHeader } from "./settings-header"
import { isDateDifferent, arrayEquals, createStartTimeSetDate, createEndTimeSetDate, createStartDateCalendarOnSelect, createEndDateCalendarOnSelect, getAvailableLanguages } from "../_lib/utils"

export function SettingsForm() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  const getLogoUploadUrlMutation = useMutation(
    trpc.marathons.getLogoUploadUrl.mutationOptions(),
  )

  if (!marathon) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Unable to load marathon. Please refresh the page.</AlertDescription>
      </Alert>
    )
  }

  const isByCameraMode = marathon.mode === "by-camera"

  const [logoState, setLogoState] = useState<{
    previewUrl: string | null
    isUploading: boolean
    hasChanged: boolean
  }>({
    previewUrl: null,
    isUploading: false,
    hasChanged: false,
  })

  const form = useForm({
    defaultValues: {
      name: marathon.name,
      logoUrl: marathon.logoUrl || "",
      startDate: marathon.startDate ? new Date(marathon.startDate) : null,
      endDate: marathon.endDate ? new Date(marathon.endDate) : null,
      description: marathon.description || "",
      languages: marathon.languages ? marathon.languages.split(",") : ["en"],
    },
    onSubmit: async ({ value }) => {
      const file = fileInputRef.current?.files?.[0]

      let logoUrl = value.logoUrl

      if (file) {
        const uploadedLogoUrl = await handleLogoUpload(file)
        if (uploadedLogoUrl) {
          logoUrl = uploadedLogoUrl
        }
      }

      if (logoUrl === "pending-upload") {
        logoUrl = marathon.logoUrl ?? ""
      }

      updateMarathonSettings({
        domain,
        data: {
          name: value.name,
          description: value.description,
          ...(isByCameraMode
            ? {}
            : {
                startDate: value.startDate
                  ? value.startDate.toISOString()
                  : undefined,
                endDate: value.endDate
                  ? value.endDate.toISOString()
                  : undefined,
              }),
          logoUrl,
        },
      })
    },
  })

  const { mutate: updateMarathonSettings, isPending: isUpdatingMarathon } =
    useMutation(
      trpc.marathons.update.mutationOptions({
        onSuccess: () => {
          toast.success("Marathon settings updated successfully")
        },
        onError: (error) => {
          toast.error(error.message || "Something went wrong")
        },
        onSettled: () => {
          queryClient.invalidateQueries({
            queryKey: trpc.marathons.pathKey(),
          })
          queryClient.invalidateQueries({
            queryKey: trpc.rules.pathKey(),
          })
          queryClient.invalidateQueries({
            queryKey: trpc.validations.pathKey(),
          })
        },
      }),
    )

  const { mutateAsync: resetMarathonAsync, isPending: isResettingMarathon } =
    useMutation(
      trpc.marathons.reset.mutationOptions({
        onSuccess: () => {
          toast.success("Marathon reset successfully")
          queryClient.invalidateQueries({
            queryKey: trpc.marathons.pathKey(),
          })
          queryClient.invalidateQueries({
            queryKey: trpc.participants.pathKey(),
          })
          queryClient.invalidateQueries({
            queryKey: trpc.topics.pathKey(),
          })
          queryClient.invalidateQueries({
            queryKey: trpc.competitionClasses.pathKey(),
          })
          queryClient.invalidateQueries({
            queryKey: trpc.deviceGroups.pathKey(),
          })
          router.refresh()
        },
        onError: (error) => {
          toast.error(error.message || "Failed to reset marathon")
        },
      }),
    )

  useEffect(() => {
    const fileInput = fileInputRef.current
    if (!fileInput) return

    const handleFileChange = () => {
      if (logoState.previewUrl) {
        URL.revokeObjectURL(logoState.previewUrl)
      }

      const file = fileInput.files?.[0]
      if (file) {
        const url = URL.createObjectURL(file)
        setLogoState((prev) => ({
          ...prev,
          previewUrl: url,
          hasChanged: true,
        }))
        form.setFieldValue("logoUrl", "pending-upload")
      } else {
        setLogoState((prev) => ({
          ...prev,
          previewUrl: null,
          hasChanged: false,
        }))
      }
    }

    fileInput.addEventListener("change", handleFileChange)
    return () => {
      fileInput.removeEventListener("change", handleFileChange)
      if (logoState.previewUrl) {
        URL.revokeObjectURL(logoState.previewUrl)
      }
    }
  }, [logoState.previewUrl, form])

  const handleLogoUpload = async (file: File): Promise<string | null> => {
    setLogoState((prev) => ({ ...prev, isUploading: true }))

    try {
      const result = await getLogoUploadUrlMutation.mutateAsync({
        domain,
        currentKey: marathon.logoUrl ?? null,
      })

      const { publicUrl, url } = result

      await fetch(url as string, {
        method: "PUT",
        body: file,
      })

      const logoUrl = publicUrl
      form.setFieldValue("logoUrl", logoUrl)
      return logoUrl
    } catch (error) {
      toast.error("Failed to upload logo")
      return null
    } finally {
      setLogoState((prev) => ({ ...prev, isUploading: false }))
    }
  }

  const handleRemoveLogo = () => {
    form.setFieldValue("logoUrl", marathon.logoUrl || "")

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    if (logoState.previewUrl) {
      URL.revokeObjectURL(logoState.previewUrl)
    }

    setLogoState({
      previewUrl: null,
      isUploading: false,
      hasChanged: false,
    })

    const formValues = form.state.values
    const isDirtyExceptLogo =
      formValues.name !== marathon.name ||
      formValues.description !== (marathon.description || "") ||
      isDateDifferent(formValues.startDate, marathon.startDate) ||
      isDateDifferent(formValues.endDate, marathon.endDate) ||
      !arrayEquals(
        formValues.languages || [],
        marathon.languages ? marathon.languages.split(",") : ["en"],
      )

    if (!isDirtyExceptLogo) {
      form.reset()
    }
  }

  const handleResetMarathon = async () => {
    await resetMarathonAsync({ domain })
  }

  return (
    <div className="space-y-10">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          form.handleSubmit()
        }}
      >
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <SettingsHeader />
          </div>
          <form.Subscribe
            selector={(state) => [state.isSubmitting, state.canSubmit]}
            children={([isSubmitting, canSubmit]) => (
              <PrimaryButton
                type="submit"
                className="w-full shrink-0 sm:w-auto sm:self-center"
                disabled={
                  isSubmitting || !canSubmit || isUpdatingMarathon
                }
              >
                {isSubmitting || isUpdatingMarathon
                  ? "Saving…"
                  : "Save Changes"}
              </PrimaryButton>
            )}
          />
        </div>
        <div className="space-y-10">
          {/* General */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
              <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
                General
              </p>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
              Basic information about your marathon — name, logo, and description shown to participants.
            </p>
            <div className="rounded-xl border border-border/60 bg-white p-5">
              <div className="grid grid-cols-1 gap-6">
                <form.Field
                  name="name"
                  children={(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Marathon Name</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Enter marathon name…"
                        autoComplete="organization"
                      />
                      {field.state.meta.isTouched &&
                        field.state.meta.errors.length ? (
                        <p className="text-sm text-destructive">
                          {field.state.meta.errors.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  )}
                />

                <LogoUploadField
                  previewUrl={logoState.previewUrl}
                  fileInputRef={fileInputRef}
                  onRemove={handleRemoveLogo}
                />

                <form.Field
                  name="description"
                  children={(field) => (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={field.name}>Description</Label>
                        <span className="text-xs text-muted-foreground">
                          Supports Markdown formatting
                        </span>
                      </div>
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Brief description, rules, and guidelines for participants. Markdown is supported."
                        className="min-h-[200px] bg-background font-mono text-sm"
                      />
                      <div className="text-xs text-muted-foreground">
                        This content will appear in the "Competition Rules"
                        section on the participation page.
                      </div>
                      {field.state.meta.isTouched &&
                        field.state.meta.errors.length ? (
                        <p className="text-sm text-destructive">
                          {field.state.meta.errors.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  )}
                />
              </div>
            </div>
          </section>

          {/* Date & Time */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
                <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
                  Date & Time
                </p>
              </div>
              {isByCameraMode && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <Info className="h-3 w-3" />
                  Not applicable for by-camera mode
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
              Set the start and end dates for your marathon contest window.
            </p>
            <div
              className={cn(
                "rounded-xl border border-border/60 bg-white p-5",
                isByCameraMode && "opacity-50 pointer-events-none blur-[2px]",
              )}
            >
              <div className="grid grid-cols-2 gap-4">
                <form.Field
                  name="startDate"
                  children={(field) => (
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="start-date-picker">Start Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="start-date-picker"
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              !field.state.value && "text-muted-foreground",
                            )}
                            aria-label={field.state.value ? `Start date: ${format(field.state.value, "PPP")}` : "Pick a start date"}
                          >
                            {field.state.value ? (
                              format(field.state.value, "PPP")
                            ) : (
                              <span>Pick a start date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" aria-hidden />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={field.state.value || undefined}
                            onSelect={createStartDateCalendarOnSelect(
                              field.state.value,
                              form.state.values.endDate,
                              field.handleChange,
                              (d) => form.setFieldValue("endDate", d),
                            )}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {field.state.meta.isTouched &&
                        field.state.meta.errors.length ? (
                        <p className="text-sm text-destructive">
                          {field.state.meta.errors.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  )}
                />

                <form.Field
                  name="endDate"
                  children={(field) => (
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="end-date-picker">End Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="end-date-picker"
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              !field.state.value && "text-muted-foreground",
                            )}
                            aria-label={field.state.value ? `End date: ${format(field.state.value, "PPP")}` : "Pick an end date"}
                          >
                            {field.state.value ? (
                              format(field.state.value, "PPP")
                            ) : (
                              <span>Pick an end date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" aria-hidden />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={field.state.value || undefined}
                            onSelect={createEndDateCalendarOnSelect(
                              field.state.value,
                              form.state.values.startDate,
                              field.handleChange,
                            )}
                            disabled={(date) => {
                              const startDate = form.state.values.startDate
                              if (!startDate) return false

                              return (
                                date <
                                new Date(
                                  startDate.getFullYear(),
                                  startDate.getMonth(),
                                  startDate.getDate(),
                                )
                              )
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {field.state.meta.isTouched &&
                        field.state.meta.errors.length ? (
                        <p className="text-sm text-destructive">
                          {field.state.meta.errors.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <form.Field
                    name="startDate"
                    children={(field) => (
                      <div>
                        <Label>Start Time</Label>
                        <div className="flex items-center space-x-2">
                          <div className="p-2 border rounded-lg flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                            <TimePickerInput
                              date={field.state.value || undefined}
                              setDate={createStartTimeSetDate(
                                field.state.value,
                                form.state.values.endDate,
                                field.handleChange,
                                (d) => form.setFieldValue("endDate", d),
                              )}
                              picker="hours"
                              aria-label="Hours"
                            />
                            <span className="text-sm">:</span>
                            <TimePickerInput
                              date={field.state.value || undefined}
                              setDate={createStartTimeSetDate(
                                field.state.value,
                                form.state.values.endDate,
                                field.handleChange,
                                (d) => form.setFieldValue("endDate", d),
                              )}
                              picker="minutes"
                              aria-label="Minutes"
                            />
                          </div>
                        </div>
                        {field.state.meta.isTouched &&
                          field.state.meta.errors.length ? (
                          <p className="text-sm text-destructive">
                            {field.state.meta.errors.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <form.Field
                    name="endDate"
                    children={(field) => (
                      <div>
                        <Label>End Time</Label>
                        <div className="flex items-center space-x-2">
                          <div className="p-2 border rounded-lg flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
                            <TimePickerInput
                              date={field.state.value || undefined}
                              setDate={createEndTimeSetDate(
                                field.state.value,
                                form.state.values.startDate,
                                field.handleChange,
                              )}
                              picker="hours"
                              aria-label="Hours"
                            />
                            <span className="text-sm">:</span>
                            <TimePickerInput
                              date={field.state.value || undefined}
                              setDate={createEndTimeSetDate(
                                field.state.value,
                                form.state.values.startDate,
                                field.handleChange,
                              )}
                              picker="minutes"
                              aria-label="Minutes"
                            />
                          </div>
                        </div>
                        {field.state.meta.isTouched &&
                          field.state.meta.errors.length ? (
                          <p className="text-sm text-destructive">
                            {field.state.meta.errors.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    )}
                  />
                </div>
              </div>

              <DateDurationSummary
                startDate={form.state.values.startDate}
                endDate={form.state.values.endDate}
              />
            </div>
          </section>

          {/* Languages */}
          <section>
            <div className="flex items-center gap-2.5 mb-4">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-primary" />
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-foreground">
                  Languages
                </p>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  Coming soon
                </span>
              </div>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">
              Select the languages your marathon should support for participants.
            </p>
            <div className="rounded-xl border border-border/60 bg-white p-5">
              <form.Field
                name="languages"
                children={(field) => (
                  <div>
                    <div className="relative">
                      <Command className="rounded-lg border opacity-50 pointer-events-none">
                        <CommandInput
                          placeholder="Search languages..."
                          className="flex w-full flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                          disabled
                        />
                        <CommandList>
                          <CommandEmpty>No languages found.</CommandEmpty>
                          {getAvailableLanguages().map((language) => (
                            <CommandItem
                              key={language.code}
                              className="flex items-center gap-2 px-4 py-2"
                            >
                              <div className="flex items-center justify-center rounded-sm size-5 border mr-2">
                                {field.state.value?.includes(
                                  language.code,
                                ) && (
                                    <Check className="h-4 w-4 text-primary" />
                                  )}
                              </div>
                              <Globe className="h-3 w-3 opacity-50" aria-hidden />
                              <span className="font-medium text-sm">
                                {language.name}
                              </span>
                              <span className="ml-auto text-xs text-muted-foreground">
                                {language.code}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </div>
                    {field.state.meta.isTouched &&
                      field.state.meta.errors.length ? (
                      <p className="text-sm text-destructive">
                        {field.state.meta.errors.join(", ")}
                      </p>
                    ) : null}
                  </div>
                )}
              />
            </div>
          </section>

        </div>
      </form>

      {/* Danger Zone */}
      <DangerZoneSection
        marathonName={marathon.name}
        onReset={handleResetMarathon}
        isResettingMarathon={isResettingMarathon}
      />
    </div>
  )
}
