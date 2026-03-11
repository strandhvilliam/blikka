"use client";

import { CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";
import { Icon } from "@iconify/react";
import type { CompetitionClass, DeviceGroup, Topic } from "@blikka/db";

import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ParticipantUploadFormApi } from "@/hooks/use-participant-upload-form";

interface ParticipantDetailsStepProps {
  reference: string;
  form: ParticipantUploadFormApi;
  competitionClasses: CompetitionClass[];
  deviceGroups: DeviceGroup[];
  selectedTopics: Topic[];
  isBusy: boolean;
}

function CompetitionClassCard({
  competitionClass,
  isSelected,
  disabled,
  onSelect,
}: {
  competitionClass: CompetitionClass;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.div whileTap={disabled ? undefined : { scale: 0.97 }}>
      <Card
        className={cn(
          "relative cursor-pointer overflow-hidden py-0 transition-all duration-200",
          isSelected && "ring-2 ring-primary/20 shadow-md",
          disabled && "pointer-events-none opacity-60",
        )}
        onClick={onSelect}
      >
        <div
          className={cn(
            "flex items-center gap-4 px-4 py-3",
            isSelected && "bg-foreground/3",
          )}
        >
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
              isSelected ? "bg-primary/10" : "bg-muted/50",
            )}
          >
            <span
              className={cn(
                "text-2xl font-bold transition-colors duration-200",
                isSelected ? "text-primary" : "text-foreground/80",
              )}
            >
              {competitionClass.numberOfPhotos}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="truncate">{competitionClass.name}</span>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: isSelected ? 1 : 0,
                  opacity: isSelected ? 1 : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </motion.div>
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {competitionClass.numberOfPhotos === 1
                ? "1 photo"
                : `${competitionClass.numberOfPhotos} photos`}
              {competitionClass.description
                ? ` · ${competitionClass.description}`
                : ""}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function DeviceGroupCard({
  deviceGroup,
  isSelected,
  disabled,
  onSelect,
}: {
  deviceGroup: DeviceGroup;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.div whileTap={disabled ? undefined : { scale: 0.97 }}>
      <Card
        className={cn(
          "relative cursor-pointer overflow-hidden py-0 transition-all duration-200",
          isSelected && "ring-2 ring-primary/20 shadow-md",
          disabled && "pointer-events-none opacity-60",
        )}
        onClick={onSelect}
      >
        <div
          className={cn(
            "flex items-center gap-4 px-4 py-3",
            isSelected && "bg-foreground/3",
          )}
        >
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
              isSelected ? "bg-primary/10" : "bg-muted/50",
            )}
          >
            <span
              className={cn(
                "transition-colors duration-200",
                isSelected ? "text-primary" : "text-foreground/80",
              )}
            >
              {deviceGroup.icon === "smartphone" ? (
                <Icon icon="solar:smartphone-broken" className="h-8 w-8" />
              ) : (
                <Icon
                  icon="solar:camera-minimalistic-broken"
                  className="h-8 w-8"
                />
              )}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="truncate">{deviceGroup.name}</span>
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: isSelected ? 1 : 0,
                  opacity: isSelected ? 1 : 0,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </motion.div>
            </CardTitle>
            {deviceGroup.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {deviceGroup.description}
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function ParticipantDetailsStep({
  reference,
  form,
  competitionClasses,
  deviceGroups,
  selectedTopics,
  isBusy,
}: ParticipantDetailsStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Participant #{reference}
        </p>
        <h2 className="mt-2 font-rocgrotesk text-3xl leading-none text-foreground">
          Fill in details
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This participant wasn&apos;t prepared beforehand. Enter their name,
          email, and select class and device below.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <form.Field name="firstName">
            {(field) => {
              const hasError =
                !field.state.meta.isValid && field.state.meta.isTouched;
              return (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    First name
                  </label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="James"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    className={cn(
                      "h-12 rounded-xl text-base",
                      hasError &&
                        "border-rose-400 focus-visible:ring-rose-400",
                    )}
                  />
                  {hasError && field.state.meta.errors.length > 0 ? (
                    <p className="text-sm text-rose-600">
                      {field.state.meta.errors[0]}
                    </p>
                  ) : null}
                </div>
              );
            }}
          </form.Field>

          <form.Field name="lastName">
            {(field) => {
              const hasError =
                !field.state.meta.isValid && field.state.meta.isTouched;
              return (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Last name
                  </label>
                  <Input
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder="Bond"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    className={cn(
                      "h-12 rounded-xl text-base",
                      hasError &&
                        "border-rose-400 focus-visible:ring-rose-400",
                    )}
                  />
                  {hasError && field.state.meta.errors.length > 0 ? (
                    <p className="text-sm text-rose-600">
                      {field.state.meta.errors[0]}
                    </p>
                  ) : null}
                </div>
              );
            }}
          </form.Field>
        </div>

        <form.Field name="email">
          {(field) => {
            const hasError =
              !field.state.meta.isValid && field.state.meta.isTouched;
            return (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="participant@example.com"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  className={cn(
                    "h-12 rounded-xl text-base",
                    hasError &&
                      "border-rose-400 focus-visible:ring-rose-400",
                  )}
                />
                {hasError && field.state.meta.errors.length > 0 ? (
                  <p className="text-sm text-rose-600">
                    {field.state.meta.errors[0]}
                  </p>
                ) : null}
              </div>
            );
          }}
        </form.Field>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            Competition class
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            How many photos is this participant submitting?
          </p>
        </div>
        <form.Field name="competitionClassId">
          {(field) => (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {competitionClasses.map((cc) => (
                  <CompetitionClassCard
                    key={cc.id}
                    competitionClass={cc}
                    isSelected={field.state.value === String(cc.id)}
                    disabled={isBusy}
                    onSelect={() => field.handleChange(String(cc.id))}
                  />
                ))}
              </div>
              {!field.state.meta.isValid &&
              field.state.meta.isTouched &&
              field.state.meta.errors.length > 0 ? (
                <p className="text-sm text-rose-600">
                  {field.state.meta.errors[0]}
                </p>
              ) : null}
            </div>
          )}
        </form.Field>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Device</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            What did they shoot with?
          </p>
        </div>
        <form.Field name="deviceGroupId">
          {(field) => (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                {deviceGroups.map((dg) => (
                  <DeviceGroupCard
                    key={dg.id}
                    deviceGroup={dg}
                    isSelected={field.state.value === String(dg.id)}
                    disabled={isBusy}
                    onSelect={() => field.handleChange(String(dg.id))}
                  />
                ))}
              </div>
              {!field.state.meta.isValid &&
              field.state.meta.isTouched &&
              field.state.meta.errors.length > 0 ? (
                <p className="text-sm text-rose-600">
                  {field.state.meta.errors[0]}
                </p>
              ) : null}
            </div>
          )}
        </form.Field>
      </div>

      {selectedTopics.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Photo order ({selectedTopics.length}{" "}
            {selectedTopics.length === 1 ? "topic" : "topics"})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedTopics.map((topic) => (
              <div
                key={topic.id}
                className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground"
              >
                #{topic.orderIndex + 1} {topic.name}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
