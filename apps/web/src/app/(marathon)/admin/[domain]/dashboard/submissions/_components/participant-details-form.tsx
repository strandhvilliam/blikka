"use client";

import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ParticipantUploadFormApi } from "../_hooks/use-participant-upload-form";


interface ParticipantDetailsFormProps {
  form: ParticipantUploadFormApi;
  marathonMode: string;
}

export function ParticipantDetailsForm({
  form,
  marathonMode,
}: ParticipantDetailsFormProps) {
  return (
    <section className="rounded-xl border border-[#e2e2d8] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-gothic text-lg text-[#1f1f1f]">
          Participant Details
        </h3>
        <Badge
          variant="outline"
          className="border-[#deded4] text-[#717169]"
        >
          Required
        </Badge>
      </div>

      <div className="space-y-4">
        <form.Field
          name="reference"
          validators={{
            onChange: ({ value }) => {
              if (!/^\d{0,4}$/.test(value)) return undefined;
              if (value.length > 0 && !/^\d{1,4}$/.test(value)) {
                return "Participant reference must be 1-4 digits";
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                Reference
              </label>
              <Input
                value={field.state.value}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  field.handleChange(v);
                }}
                onBlur={() => {
                  if (field.state.value.length > 0) {
                    field.handleChange(field.state.value.padStart(4, "0"));
                  }
                  field.handleBlur();
                }}
                placeholder="0001"
                inputMode="numeric"
                maxLength={4}
                className={cn(
                  "font-mono text-lg tracking-[0.2em]",
                  !field.state.meta.isValid &&
                  field.state.meta.isTouched &&
                  "border-rose-400 focus-visible:ring-rose-400",
                )}
              />
              {!field.state.meta.isValid && field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                <p className="text-xs text-rose-600">
                  {field.state.meta.errors.join(", ")}
                </p>
              ) : null}
            </div>
          )}
        </form.Field>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <form.Field name="firstName">
            {(field) => (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                  First Name
                </label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="James"
                  className={cn(
                    !field.state.meta.isValid &&
                    field.state.meta.isTouched &&
                    "border-rose-400 focus-visible:ring-rose-400",
                  )}
                />
                {!field.state.meta.isValid && field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <p className="text-xs text-rose-600">
                    {field.state.meta.errors.join(", ")}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field name="lastName">
            {(field) => (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                  Last Name
                </label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Bond"
                  className={cn(
                    !field.state.meta.isValid &&
                    field.state.meta.isTouched &&
                    "border-rose-400 focus-visible:ring-rose-400",
                  )}
                />
                {!field.state.meta.isValid && field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <p className="text-xs text-rose-600">
                    {field.state.meta.errors.join(", ")}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                  Email
                </label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="participant@example.com"
                  className={cn(
                    !field.state.meta.isValid &&
                    field.state.meta.isTouched &&
                    "border-rose-400 focus-visible:ring-rose-400",
                  )}
                />
                {!field.state.meta.isValid && field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <p className="text-xs text-rose-600">
                    {field.state.meta.errors.join(", ")}
                  </p>
                ) : null}
              </div>
            )}
          </form.Field>

          {marathonMode === "by-camera" ? (
            <form.Field name="phone">
              {(field) => (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                    Phone Number
                  </label>
                  <PhoneInput
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value || "")}
                    onBlur={field.handleBlur}
                    defaultCountry="SE"
                    className={cn(
                      !field.state.meta.isValid &&
                      field.state.meta.isTouched &&
                      "[&_input]:border-rose-400 [&_input]:focus-visible:ring-rose-400",
                    )}
                  />
                  {!field.state.meta.isValid && field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                    <p className="text-xs text-rose-600">
                      {field.state.meta.errors.join(", ")}
                    </p>
                  ) : null}
                </div>
              )}
            </form.Field>
          ) : (
            <div className="space-y-2 md:col-span-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#66665f]">
                Phone Number
              </label>
              <Input
                value=""
                disabled
                placeholder="Only required in by-camera mode"
                className="bg-slate-50 text-slate-400"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
