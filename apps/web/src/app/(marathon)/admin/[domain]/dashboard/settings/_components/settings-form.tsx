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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar } from "@/components/ui/calendar"
import { TimePickerInput } from "@/components/ui/time-picker"
import { toast } from "sonner"
import { PrimaryButton } from "@/components/ui/primary-button"
import { SettingsPhonePreview } from "./settings-phone-preview"
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
import { parseAsStringEnum, useQueryState } from "nuqs"
import type { Marathon } from "@blikka/db"
import { TermsMarkdownPreview } from "./terms-markdown-preview"
import { LogoUploadField } from "./logo-upload-field"
import { TermsImportField } from "./terms-import-field"
import { DateDurationSummary } from "./date-duration-summary"
import { DangerZoneTab } from "./danger-zone-tab"
import { isDateDifferent, arrayEquals, createStartTimeSetDate, createEndTimeSetDate, createStartDateCalendarOnSelect, createEndDateCalendarOnSelect, getAvailableLanguages } from "../_lib/utils"

const customTabTriggerClassName =
  "relative py-4 px-0 text-sm font-medium transition-colors rounded-none bg-transparent border-none shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-brand-primary text-muted-foreground hover:text-foreground data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-brand-primary"

export function SettingsForm() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringEnum([
      "general",
      "date-time",
      "languages",
      "terms",
      "danger",
    ]).withDefault("general"),
  )

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  )

  const getLogoUploadUrlMutation = useMutation(
    trpc.marathons.getLogoUploadUrl.mutationOptions(),
  )

  const getTermsUploadUrlMutation = useMutation(
    trpc.marathons.getTermsUploadUrl.mutationOptions(),
  )

  const { data: currentTerms } = useSuspenseQuery(
    trpc.marathons.getCurrentTerms.queryOptions({
      domain,
    }),
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

  const [termsState, setTermsState] = useState<{
    isUploading: boolean
    hasChanged: boolean
  }>({
    isUploading: false,
    hasChanged: false,
  })
  const [termsMarkdown, setTermsMarkdown] = useState("")

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
      let termsKey: string | undefined

      if (file) {
        const uploadedLogoUrl = await handleLogoUpload(file)
        if (uploadedLogoUrl) {
          logoUrl = uploadedLogoUrl
        }
      }

      if (termsState.hasChanged && termsMarkdown.trim()) {
        const termsFile = new File([termsMarkdown], "terms-and-conditions.md", {
          type: "text/markdown",
        })
        const uploadedTermsKey = await handleTermsUpload(termsFile)
        if (uploadedTermsKey) {
          termsKey = uploadedTermsKey
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
          termsAndConditionsKey: termsKey,
        },
      })
    },
  })

  const previewMarathon: Marathon = {
    ...marathon,
    name: form.state.values.name || marathon.name,
    description: form.state.values.description || marathon.description || "",
    startDate: form.state.values.startDate
      ? form.state.values.startDate.toISOString()
      : marathon.startDate,
    endDate: form.state.values.endDate
      ? form.state.values.endDate.toISOString()
      : marathon.endDate,
    logoUrl:
      logoState.previewUrl || form.state.values.logoUrl || marathon.logoUrl,
    languages: form.state.values.languages
      ? form.state.values.languages.join(",")
      : marathon.languages,
  }

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
    if (currentTerms && !termsMarkdown) {
      setTermsMarkdown(currentTerms)
    }
  }, [currentTerms, termsMarkdown])

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

  const handleTermsUpload = async (file: File): Promise<string | null> => {
    setTermsState((prev) => ({ ...prev, isUploading: true }))

    try {
      const result = await getTermsUploadUrlMutation.mutateAsync({
        domain,
      })

      const { key, url } = result

      await fetch(url as string, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "text/markdown",
        },
      })

      return key
    } catch (error) {
      toast.error("Failed to upload terms and conditions")
      return null
    } finally {
      setTermsState((prev) => ({ ...prev, isUploading: false }))
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
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="grid grid-cols-5 gap-12">
        <div className="col-span-3">
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(
                value as
                | "general"
                | "date-time"
                | "languages"
                | "terms"
                | "danger",
              )
            }
          >
            <div className="border-b border-border mb-6">
              <TabsList className="bg-transparent rounded-none p-0 h-auto flex gap-8 -mb-px">
                <TabsTrigger
                  value="general"
                  className={customTabTriggerClassName}
                >
                  General
                </TabsTrigger>
                <TabsTrigger
                  value="date-time"
                  className={customTabTriggerClassName}
                >
                  Date & Time
                </TabsTrigger>
                <TabsTrigger
                  value="languages"
                  className={customTabTriggerClassName}
                >
                  Languages
                </TabsTrigger>
                <TabsTrigger
                  value="terms"
                  className={customTabTriggerClassName}
                >
                  Terms & Conditions
                </TabsTrigger>
                <TabsTrigger
                  value="danger"
                  className={customTabTriggerClassName}
                >
                  Danger Zone
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="general" className="space-y-6">
              <div className="grid grid-cols-1 gap-6 max-w-2xl">
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
                        placeholder={`Enter contest description, rules, and guidelines…

Examples of formatting:
 **Bold text**
 *Italic text*
 # Heading
 ## Subheading
 - List item
 1. Numbered list
 [Link text](https://example.com)`}
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
            </TabsContent>

            <TabsContent value="date-time" className="space-y-6">
              <div className="grid grid-cols-1 gap-6 max-w-2xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-col">
                      <h3 className="font-medium">Contest Schedule</h3>
                      <p className="text-xs text-muted-foreground">
                        Set the start and end dates for your marathon
                      </p>
                    </div>
                    {isByCameraMode && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-md z-10 relative">
                        <Info className="size-4" />
                        <span>Not applicable for by-camera mode</span>
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
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
                </div>
              </div>
            </TabsContent>

            <TabsContent value="languages" className="space-y-6">
              <div className="grid grid-cols-1 gap-6 max-w-2xl">
                <div className="space-y-4 relative">
                  <div className="flex gap-1 flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-muted-foreground">
                        Available Languages
                      </h3>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                        Coming soon...
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select the languages your marathon should support
                    </p>
                  </div>

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
              </div>
            </TabsContent>

            <TabsContent value="terms" className="space-y-6">
              <div className="grid grid-cols-1 gap-6 max-w-2xl">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="terms-markdown">Terms and Conditions</Label>
                    <span className="text-xs text-muted-foreground">
                      Markdown only
                    </span>
                  </div>
                  <Textarea
                    id="terms-markdown"
                    value={termsMarkdown}
                    onChange={(e) => {
                      setTermsMarkdown(e.target.value)
                      setTermsState((prev) => ({ ...prev, hasChanged: true }))
                    }}
                    placeholder={`Enter terms and conditions in Markdown…

Examples of formatting:
 **Bold text**
 *Italic text*
 # Heading
 ## Subheading
 - List item
 1. Numbered list
[Link text](https://example.com)`}
                    className="min-h-[260px] max-h-[260px] bg-background font-mono text-sm"
                  />
                  <div className="text-xs text-muted-foreground">
                    This content will be shown when participants open the terms
                    link.
                  </div>
                </div>

                <TermsImportField
                  onMarkdownImported={(markdown) => {
                    setTermsMarkdown(markdown)
                    setTermsState((prev) => ({ ...prev, hasChanged: true }))
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="danger" className="space-y-6">
              <DangerZoneTab
                marathonName={marathon.name}
                onReset={handleResetMarathon}
                isResettingMarathon={isResettingMarathon}
              />
            </TabsContent>
          </Tabs>

          <form.Subscribe
            selector={(state) => [state.isSubmitting, state.canSubmit]}
            children={([isSubmitting, canSubmit]) => (
              <>
                {activeTab !== "danger" && (
                  <div className="flex mt-6">
                    <PrimaryButton
                      type="submit"
                      disabled={
                        isSubmitting || !canSubmit || isUpdatingMarathon
                      }
                    >
                      {isSubmitting || isUpdatingMarathon
                        ? "Saving…"
                        : "Save Changes"}
                    </PrimaryButton>
                  </div>
                )}
              </>
            )}
          />
        </div>

        <div className="relative w-fit">
          <h2 className="text-lg font-medium mb-4 font-gothic">Preview</h2>
          <div className="sticky top-8 bg-background">
            {activeTab === "terms" ? (
              <TermsMarkdownPreview markdown={termsMarkdown} />
            ) : (
              <SettingsPhonePreview marathon={previewMarathon} />
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
