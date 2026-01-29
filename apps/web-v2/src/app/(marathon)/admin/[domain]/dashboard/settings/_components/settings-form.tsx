"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ImagePlus,
  X,
  Check,
  Globe,
  Calendar as CalendarIcon,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { TimePickerInput } from "@/components/ui/time-picker";
import { toast } from "sonner";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SettingsPhonePreview } from "./settings-phone-preview";
import { useForm } from "@tanstack/react-form";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useDomain } from "@/lib/domain-provider";
import {
  useQueryClient,
  useSuspenseQuery,
  useMutation,
} from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { parseAsStringEnum, useQueryState } from "nuqs";
import type { Marathon } from "@blikka/db";
import mammoth from "mammoth";
import TurndownService from "turndown";
import { TermsMarkdownPreview } from "./terms-markdown-preview";

const AVAILABLE_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "sv", name: "Swedish" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "nl", name: "Dutch" },
  { code: "no", name: "Norwegian" },
  { code: "da", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "pl", name: "Polish" },
];

function isDateDifferent(
  date1: Date | null | undefined,
  date2: string | null | undefined,
): boolean {
  if (!date1 && !date2) return false;
  if (!date1 || !date2) return true;

  return new Date(date1).getTime() !== new Date(date2).getTime();
}

function arrayEquals(a: string[], b: string[]): boolean {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((val, index) => val === b[index])
  );
}

const customTabTriggerClassName =
  "relative py-4 px-0 text-sm font-medium transition-colors rounded-none bg-transparent border-none shadow-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#FF5D4B] dark:data-[state=active]:text-[#FF7A6B] text-muted-foreground hover:text-foreground data-[state=active]:after:content-[''] data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-0.5 data-[state=active]:after:bg-[#FF5D4B] dark:data-[state=active]:after:bg-[#FF7A6B]";

export function SettingsForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const domain = useDomain();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const termsFileInputRef = useRef<HTMLInputElement>(null);
  const [resetConfirmationText, setResetConfirmationText] = useState("");
  const [smsTestState, setSmsTestState] = useState({
    phoneNumber: "",
    message: "",
  });
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringEnum([
      "general",
      "date-time",
      "languages",
      "terms",
      "danger",
    ]).withDefault("general"),
  );

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    }),
  );

  const getLogoUploadUrlMutation = useMutation(
    trpc.marathons.getLogoUploadUrl.mutationOptions(),
  );

  const getTermsUploadUrlMutation = useMutation(
    trpc.marathons.getTermsUploadUrl.mutationOptions(),
  );

  const { data: currentTerms } = useSuspenseQuery(
    trpc.marathons.getCurrentTerms.queryOptions({
      domain,
    }),
  );

  if (!marathon) {
    return <div>ERROR: Unable to load marathon</div>;
  }

  const [logoState, setLogoState] = useState<{
    previewUrl: string | null;
    isUploading: boolean;
    hasChanged: boolean;
  }>({
    previewUrl: null,
    isUploading: false,
    hasChanged: false,
  });

  const [termsState, setTermsState] = useState<{
    fileName: string | null;
    isUploading: boolean;
    hasChanged: boolean;
  }>({
    fileName: null,
    isUploading: false,
    hasChanged: false,
  });
  const [termsMarkdown, setTermsMarkdown] = useState("");

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
      const file = fileInputRef.current?.files?.[0];

      let logoUrl = value.logoUrl;
      let termsKey: string | undefined;

      if (file) {
        const uploadedLogoUrl = await handleLogoUpload(file);
        if (uploadedLogoUrl) {
          logoUrl = uploadedLogoUrl;
        }
      }

      if (termsState.hasChanged && termsMarkdown.trim()) {
        const termsFile = new File([termsMarkdown], "terms-and-conditions.md", {
          type: "text/markdown",
        });
        const uploadedTermsKey = await handleTermsUpload(termsFile);
        if (uploadedTermsKey) {
          termsKey = uploadedTermsKey;
        }
      }

      if (logoUrl === "pending-upload") {
        logoUrl = marathon.logoUrl ?? "";
      }

      updateMarathonSettings({
        domain,
        data: {
          name: value.name,
          description: value.description,
          startDate: value.startDate
            ? value.startDate.toISOString()
            : undefined,
          endDate: value.endDate ? value.endDate.toISOString() : undefined,
          logoUrl,
          termsAndConditionsKey: termsKey,
        },
      });
    },
  });

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
  };

  const { mutate: updateMarathonSettings, isPending: isUpdatingMarathon } =
    useMutation(
      trpc.marathons.update.mutationOptions({
        onSuccess: () => {
          toast.success("Marathon settings updated successfully");
        },
        onError: (error) => {
          toast.error(error.message || "Something went wrong");
        },
        onSettled: () => {
          queryClient.invalidateQueries({
            queryKey: trpc.marathons.pathKey(),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.rules.pathKey(),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.validations.pathKey(),
          });
        },
      }),
    );

  const { mutate: resetMarathon, isPending: isResettingMarathon } = useMutation(
    trpc.marathons.reset.mutationOptions({
      onSuccess: () => {
        toast.success("Marathon reset successfully");
        setResetConfirmationText("");
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.participants.pathKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.topics.pathKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.competitionClasses.pathKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.deviceGroups.pathKey(),
        });
        router.refresh();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to reset marathon");
      },
    }),
  );

  const { mutate: sendTestSMS, isPending: isSendingSMS } = useMutation(
    trpc.sms.sendTest.mutationOptions({
      onSuccess: (data) => {
        toast.success(`SMS sent successfully! Message ID: ${data.messageId}`);
        setSmsTestState({ phoneNumber: "", message: "" });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send SMS");
      },
    }),
  );

  useEffect(() => {
    if (currentTerms && !termsMarkdown) {
      setTermsMarkdown(currentTerms);
    }
  }, [currentTerms, termsMarkdown]);

  useEffect(() => {
    const fileInput = fileInputRef.current;
    if (!fileInput) return;

    const handleFileChange = () => {
      if (logoState.previewUrl) {
        URL.revokeObjectURL(logoState.previewUrl);
      }

      const file = fileInput.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        setLogoState((prev) => ({
          ...prev,
          previewUrl: url,
          hasChanged: true,
        }));
        form.setFieldValue("logoUrl", "pending-upload");
      } else {
        setLogoState((prev) => ({
          ...prev,
          previewUrl: null,
          hasChanged: false,
        }));
      }
    };

    fileInput.addEventListener("change", handleFileChange);
    return () => {
      fileInput.removeEventListener("change", handleFileChange);
      if (logoState.previewUrl) {
        URL.revokeObjectURL(logoState.previewUrl);
      }
    };
  }, [logoState.previewUrl, form]);

  const handleLogoUpload = async (file: File): Promise<string | null> => {
    setLogoState((prev) => ({ ...prev, isUploading: true }));

    try {
      const result = await getLogoUploadUrlMutation.mutateAsync({
        domain,
        currentKey: marathon.logoUrl ?? null,
      });

      const { key, url } = result;

      await fetch(url as string, {
        method: "PUT",
        body: file,
      });

      // Construct the logo URL - in web-v2 we might need to adjust this based on how URLs are served
      const logoUrl = key; // Or construct full URL if needed
      form.setFieldValue("logoUrl", logoUrl);
      return logoUrl;
    } catch (error) {
      toast.error("Failed to upload logo");
      return null;
    } finally {
      setLogoState((prev) => ({ ...prev, isUploading: false }));
    }
  };

  const handleTermsUpload = async (file: File): Promise<string | null> => {
    setTermsState((prev) => ({ ...prev, isUploading: true }));

    try {
      const result = await getTermsUploadUrlMutation.mutateAsync({
        domain,
      });

      const { key, url } = result;

      await fetch(url as string, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "text/markdown",
        },
      });

      return key;
    } catch (error) {
      toast.error("Failed to upload terms and conditions");
      return null;
    } finally {
      setTermsState((prev) => ({ ...prev, isUploading: false }));
    }
  };

  const parseTermsFile = async (file: File): Promise<string> => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "md" || extension === "txt") {
      return file.text();
    }

    if (extension === "docx") {
      const arrayBuffer = await file.arrayBuffer();
      const { value } = await mammoth.convertToHtml({ arrayBuffer });
      const turndownService = new TurndownService();
      return turndownService.turndown(value || "");
    }

    throw new Error("Unsupported file type");
  };

  const handleRemoveLogo = () => {
    form.setFieldValue("logoUrl", marathon.logoUrl || "");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (logoState.previewUrl) {
      URL.revokeObjectURL(logoState.previewUrl);
    }

    setLogoState({
      previewUrl: null,
      isUploading: false,
      hasChanged: false,
    });

    const formValues = form.state.values;
    const isDirtyExceptLogo =
      formValues.name !== marathon.name ||
      formValues.description !== (marathon.description || "") ||
      isDateDifferent(formValues.startDate, marathon.startDate) ||
      isDateDifferent(formValues.endDate, marathon.endDate) ||
      !arrayEquals(
        formValues.languages || [],
        marathon.languages ? marathon.languages.split(",") : ["en"],
      );

    if (!isDirtyExceptLogo) {
      form.reset();
    }
  };

  const handleResetMarathon = () => {
    if (resetConfirmationText === marathon.name) {
      resetMarathon({ domain });
    }
  };

  const isResetDisabled =
    resetConfirmationText !== marathon.name || isResettingMarathon;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
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
            className="space-y-6"
          >
            <div className="border-b border-border">
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
                        placeholder="Enter marathon name"
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

                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      className="hidden"
                      id="logo-upload"
                    />
                    {logoState.previewUrl ? (
                      <div className="flex items-center gap-3">
                        <div className="w-[42px] h-[42px] flex items-center justify-center rounded-full overflow-hidden shrink-0">
                          <img
                            src={logoState.previewUrl}
                            alt="Contest logo"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="w-full flex-1 relative h-[42px] rounded-lg overflow-hidden border bg-background flex items-center justify-between gap-3">
                          <div className="flex items-center justify-between h-full flex-1 pr-3">
                            <button
                              type="button"
                              onClick={handleRemoveLogo}
                              className="flex items-center gap-2 px-3 h-full hover:bg-muted rounded-md text-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-4 w-4" />
                              <span className="text-sm">Remove logo</span>
                            </button>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              PNG, JPG, SVG • 400x400px • 2MB
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-[42px] h-[42px] rounded-full bg-muted flex items-center justify-center shrink-0">
                          <ImagePlus className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <label
                          htmlFor="logo-upload"
                          className="px-4 w-full flex items-center h-[42px] rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-background transition-colors cursor-pointer gap-3"
                        >
                          <div className="flex items-center justify-between flex-1">
                            <span className="text-sm text-muted-foreground">
                              Click to upload logo
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              PNG, JPG, SVG • 400x400px • 2MB
                            </span>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

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
                        placeholder={`Enter contest description, rules, and guidelines...

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
                  <div className="flex gap-1 flex-col">
                    <h3 className="font-medium">Contest Schedule</h3>
                    <p className="text-xs text-muted-foreground">
                      Set the start and end dates for your marathon
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <form.Field
                      name="startDate"
                      children={(field) => (
                        <div className="flex flex-col space-y-2">
                          <Label>Start Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.state.value && "text-muted-foreground",
                                )}
                              >
                                {field.state.value ? (
                                  format(field.state.value, "PPP")
                                ) : (
                                  <span>Pick a start date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.state.value || undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    const newDate = new Date(date);
                                    if (field.state.value) {
                                      newDate.setHours(
                                        field.state.value.getHours(),
                                      );
                                      newDate.setMinutes(
                                        field.state.value.getMinutes(),
                                      );
                                    } else {
                                      newDate.setHours(12);
                                      newDate.setMinutes(0);
                                    }
                                    field.handleChange(newDate);

                                    const endDate = form.state.values.endDate;
                                    if (endDate && endDate < newDate) {
                                      const suggestedEndDate = new Date(
                                        newDate,
                                      );
                                      suggestedEndDate.setHours(
                                        suggestedEndDate.getHours() + 1,
                                      );
                                      form.setFieldValue(
                                        "endDate",
                                        suggestedEndDate,
                                      );
                                    }
                                  }
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

                    <form.Field
                      name="endDate"
                      children={(field) => (
                        <div className="flex flex-col space-y-2">
                          <Label>End Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.state.value && "text-muted-foreground",
                                )}
                              >
                                {field.state.value ? (
                                  format(field.state.value, "PPP")
                                ) : (
                                  <span>Pick an end date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.state.value || undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    const newDate = new Date(date);
                                    if (field.state.value) {
                                      newDate.setHours(
                                        field.state.value.getHours(),
                                      );
                                      newDate.setMinutes(
                                        field.state.value.getMinutes(),
                                      );
                                    } else {
                                      newDate.setHours(13);
                                      newDate.setMinutes(0);
                                    }

                                    const startDate =
                                      form.state.values.startDate;
                                    if (
                                      startDate &&
                                      date.getFullYear() ===
                                        startDate.getFullYear() &&
                                      date.getMonth() ===
                                        startDate.getMonth() &&
                                      date.getDate() === startDate.getDate()
                                    ) {
                                      if (newDate <= startDate) {
                                        newDate.setHours(
                                          startDate.getHours() + 1,
                                        );
                                        newDate.setMinutes(
                                          startDate.getMinutes(),
                                        );
                                      }
                                    }

                                    field.handleChange(newDate);
                                  }
                                }}
                                disabled={(date) => {
                                  const startDate = form.state.values.startDate;
                                  if (!startDate) return false;

                                  return (
                                    date <
                                    new Date(
                                      startDate.getFullYear(),
                                      startDate.getMonth(),
                                      startDate.getDate(),
                                    )
                                  );
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
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <TimePickerInput
                                  date={field.state.value || undefined}
                                  setDate={(date) => {
                                    if (date && field.state.value) {
                                      const newDate = new Date(
                                        field.state.value,
                                      );
                                      newDate.setHours(date.getHours());
                                      newDate.setMinutes(date.getMinutes());

                                      const endDate = form.state.values.endDate;
                                      if (
                                        endDate &&
                                        newDate.getFullYear() ===
                                          endDate.getFullYear() &&
                                        newDate.getMonth() ===
                                          endDate.getMonth() &&
                                        newDate.getDate() ===
                                          endDate.getDate() &&
                                        newDate >= endDate
                                      ) {
                                        const updatedEndDate = new Date(
                                          newDate,
                                        );
                                        updatedEndDate.setHours(
                                          updatedEndDate.getHours() + 1,
                                        );
                                        form.setFieldValue(
                                          "endDate",
                                          updatedEndDate,
                                        );
                                      }

                                      field.handleChange(newDate);
                                    }
                                  }}
                                  picker="hours"
                                  aria-label="Hours"
                                />
                                <span className="text-sm">:</span>
                                <TimePickerInput
                                  date={field.state.value || undefined}
                                  setDate={(date) => {
                                    if (date && field.state.value) {
                                      const newDate = new Date(
                                        field.state.value,
                                      );
                                      newDate.setHours(date.getHours());
                                      newDate.setMinutes(date.getMinutes());

                                      const endDate = form.state.values.endDate;
                                      if (
                                        endDate &&
                                        newDate.getFullYear() ===
                                          endDate.getFullYear() &&
                                        newDate.getMonth() ===
                                          endDate.getMonth() &&
                                        newDate.getDate() ===
                                          endDate.getDate() &&
                                        newDate >= endDate
                                      ) {
                                        const updatedEndDate = new Date(
                                          newDate,
                                        );
                                        updatedEndDate.setHours(
                                          updatedEndDate.getHours() + 1,
                                        );
                                        form.setFieldValue(
                                          "endDate",
                                          updatedEndDate,
                                        );
                                      }

                                      field.handleChange(newDate);
                                    }
                                  }}
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
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <TimePickerInput
                                  date={field.state.value || undefined}
                                  setDate={(date) => {
                                    if (date && field.state.value) {
                                      const newDate = new Date(
                                        field.state.value,
                                      );
                                      newDate.setHours(date.getHours());
                                      newDate.setMinutes(date.getMinutes());

                                      const startDate =
                                        form.state.values.startDate;
                                      if (
                                        startDate &&
                                        newDate.getFullYear() ===
                                          startDate.getFullYear() &&
                                        newDate.getMonth() ===
                                          startDate.getMonth() &&
                                        newDate.getDate() ===
                                          startDate.getDate() &&
                                        newDate <= startDate
                                      ) {
                                        return;
                                      }

                                      field.handleChange(newDate);
                                    }
                                  }}
                                  picker="hours"
                                  aria-label="Hours"
                                />
                                <span className="text-sm">:</span>
                                <TimePickerInput
                                  date={field.state.value || undefined}
                                  setDate={(date) => {
                                    if (date && field.state.value) {
                                      const newDate = new Date(
                                        field.state.value,
                                      );
                                      newDate.setHours(date.getHours());
                                      newDate.setMinutes(date.getMinutes());

                                      const startDate =
                                        form.state.values.startDate;
                                      if (
                                        startDate &&
                                        newDate.getFullYear() ===
                                          startDate.getFullYear() &&
                                        newDate.getMonth() ===
                                          startDate.getMonth() &&
                                        newDate.getDate() ===
                                          startDate.getDate() &&
                                        newDate <= startDate
                                      ) {
                                        return;
                                      }

                                      field.handleChange(newDate);
                                    }
                                  }}
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

                  <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-muted flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <span className="text-sm font-medium">
                        Marathon Duration:
                      </span>
                      {form.state.values.startDate &&
                      form.state.values.endDate ? (
                        <span className="text-sm">
                          {format(form.state.values.startDate, "PPP")} -{" "}
                          {format(form.state.values.endDate, "PPP")}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Select both dates to see duration
                        </span>
                      )}
                    </div>
                    {form.state.values.startDate &&
                      form.state.values.endDate && (
                        <div className="flex items-center gap-2 ml-4">
                          <span className="text-xs text-muted-foreground">
                            {format(form.state.values.startDate, "kk:mm")} -{" "}
                            {format(form.state.values.endDate, "kk:mm")}
                          </span>
                        </div>
                      )}
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
                              {AVAILABLE_LANGUAGES.map((language) => (
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
                                  <Globe className="h-3 w-3 opacity-50" />
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
                      setTermsMarkdown(e.target.value);
                      setTermsState((prev) => ({ ...prev, hasChanged: true }));
                    }}
                    placeholder={`Enter terms and conditions in Markdown...

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

                <div className="space-y-2">
                  <Label>Import file (optional)</Label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".md,.txt,.docx"
                      ref={termsFileInputRef}
                      className="hidden"
                      id="terms-upload"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        try {
                          const markdown = await parseTermsFile(file);
                          setTermsMarkdown(markdown);
                          setTermsState((prev) => ({
                            ...prev,
                            fileName: file.name,
                            hasChanged: true,
                          }));
                        } catch (error) {
                          toast.error("Failed to import terms file");
                        }
                      }}
                    />
                    {termsState.fileName ? (
                      <div className="flex items-center gap-3">
                        <div className="w-[42px] h-[42px] rounded-full bg-muted flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="w-full flex-1 relative h-[42px] rounded-lg overflow-hidden border bg-background flex items-center justify-between gap-3">
                          <div className="flex items-center justify-between h-full flex-1 pr-3">
                            <div className="flex items-center gap-2 px-3 h-full">
                              <span className="text-sm">
                                {termsState.fileName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (termsFileInputRef.current) {
                                  termsFileInputRef.current.value = "";
                                }
                                setTermsState((prev) => ({
                                  ...prev,
                                  fileName: null,
                                }));
                              }}
                              className="flex items-center gap-2 px-3 h-full hover:bg-muted rounded-md text-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-4 w-4" />
                              <span className="text-sm">Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-[42px] h-[42px] rounded-full bg-muted flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <label
                          htmlFor="terms-upload"
                          className="px-4 w-full flex items-center h-[42px] rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-background transition-colors cursor-pointer gap-3"
                        >
                          <div className="flex items-center justify-between flex-1">
                            <span className="text-sm text-muted-foreground">
                              Import .md, .txt, or .docx
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              DOCX, TXT, MD • 2MB max
                            </span>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Imported content is converted to Markdown and placed in the
                    editor.
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="danger" className="space-y-6">
              <div className="mt-0 bg-white">
                <Alert variant="destructive" className="bg-destructive/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="font-rocgrotesk">
                    Danger Zone
                  </AlertTitle>
                  <AlertDescription>
                    <div className="space-y-4">
                      <p>
                        Reset this marathon to clear all participants,
                        submissions, topics, competition classes, and device
                        groups. This action cannot be undone.
                      </p>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            Reset Marathon
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="font-rocgrotesk">
                              Are you absolutely sure?
                            </AlertDialogTitle>
                            <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 border border-muted p-4 rounded-lg">
                              This action cannot be undone. This will
                              permanently delete all:
                              <div className="list-disc list-inside mt-2 space-y-1">
                                <li>Participants and their submissions</li>
                                <li>Topics and their content</li>
                                <li>Competition classes and device groups</li>
                                <li>Jury invitations and validation results</li>
                                <li>All related data and configurations</li>
                              </div>
                            </div>
                          </AlertDialogHeader>
                          <div className="space-y-2">
                            <Label htmlFor="reset-confirmation">
                              Type <strong>{marathon.name}</strong> to confirm:
                            </Label>
                            <Input
                              id="reset-confirmation"
                              value={resetConfirmationText}
                              onChange={(e) =>
                                setResetConfirmationText(e.target.value)
                              }
                              placeholder={marathon.name}
                              className="font-mono"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              onClick={() => setResetConfirmationText("")}
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleResetMarathon}
                              disabled={isResetDisabled}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {isResettingMarathon
                                ? "Resetting..."
                                : "Reset Marathon"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </AlertDescription>
                </Alert>

                {/* SMS Test Section */}
                <div className="mt-6 bg-muted/30 border border-muted rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="font-medium font-rocgrotesk">SMS Test</h3>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                      Admin Only
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Send a test SMS message to verify the SMS service is working
                    correctly.
                  </p>
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="sms-phone">Phone Number</Label>
                      <Input
                        id="sms-phone"
                        type="tel"
                        placeholder="+1234567890"
                        value={smsTestState.phoneNumber}
                        onChange={(e) =>
                          setSmsTestState((prev) => ({
                            ...prev,
                            phoneNumber: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sms-message">Message</Label>
                      <Textarea
                        id="sms-message"
                        placeholder="Enter test message..."
                        value={smsTestState.message}
                        onChange={(e) =>
                          setSmsTestState((prev) => ({
                            ...prev,
                            message: e.target.value,
                          }))
                        }
                        maxLength={160}
                        className="min-h-[80px]"
                      />
                      <div className="text-xs text-muted-foreground text-right">
                        {smsTestState.message.length}/160
                      </div>
                    </div>
                    <Button
                      onClick={() =>
                        sendTestSMS({
                          phoneNumber: smsTestState.phoneNumber,
                          message: smsTestState.message,
                        })
                      }
                      disabled={
                        isSendingSMS ||
                        !smsTestState.phoneNumber ||
                        !smsTestState.message
                      }
                    >
                      {isSendingSMS ? "Sending..." : "Send Test SMS"}
                    </Button>
                  </div>
                </div>
              </div>
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
                        ? "Saving..."
                        : "Save Changes"}
                    </PrimaryButton>
                  </div>
                )}
              </>
            )}
          />
        </div>

        <div className="relative w-fit">
          <h2 className="text-lg font-medium mb-4 font-rocgrotesk">Preview</h2>
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
  );
}
