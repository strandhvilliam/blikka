"use client"

import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useForm } from "@tanstack/react-form"
import { RefreshCcw, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PrimaryButton } from "@/components/ui/primary-button"
import { parseRules, mapRulesToDbRules } from "../_lib/parse-rules"
import { MaxFileSizeRule } from "./max-file-size-rule"
import { AllowedFileTypesRule } from "./allowed-file-types-rule"
import { WithinTimerangeRule } from "./within-timerange-rule"
import { SameDeviceRule } from "./same-device-rule"
import { NoModificationsRule } from "./no-modifications-rule"
import { StrictTimestampOrderingRule } from "./strict-timestamp-ordering-rule"

export function RulesForm() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()

  const { data: dbRules } = useSuspenseQuery(
    trpc.rules.getByDomain.queryOptions({
      domain,
    })
  )

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({
      domain,
    })
  )

  const { mutate: updateRules, isPending } = useMutation(
    trpc.rules.updateMultiple.mutationOptions({
      onSuccess: () => {
        toast.success("Rules updated successfully")
      },
      onError: () => {
        toast.error("Failed to update rules")
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.rules.pathKey(),
        })
      },
    })
  )

  const rules = parseRules(dbRules, {
    startDate: marathon?.startDate ?? undefined,
    endDate: marathon?.endDate ?? undefined,
  })

  const form = useForm({
    defaultValues: rules,
    onSubmit: ({ value }) => {
      if (!marathon) {
        toast.error("Failed to update rules")
        return
      }
      updateRules({
        domain,
        data: mapRulesToDbRules(value),
      })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <form.Subscribe
          selector={(state) => ({
            isSubmitting: state.isSubmitting,
            isDirty: state.isDirty,
          })}
        >
          {({ isSubmitting, isDirty }) => (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="icon" onClick={() => form.reset()} type="button">
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <PrimaryButton
                type="submit"
                className="gap-2 w-full sm:w-auto flex-shrink-0"
                disabled={!isDirty || isSubmitting || isPending}
              >
                <Save className="h-4 w-4" />
                {isSubmitting || isPending ? "Saving..." : "Save Changes"}
              </PrimaryButton>
            </div>
          )}
        </form.Subscribe>
      </div>
      <div className="space-y-4">
        <form.Field name="max_file_size">{(field) => <MaxFileSizeRule field={field} />}</form.Field>
        <form.Field name="allowed_file_types">
          {(field) => <AllowedFileTypesRule field={field} />}
        </form.Field>
        <form.Field name="within_timerange">
          {(field) => <WithinTimerangeRule field={field} />}
        </form.Field>
        <form.Field name="same_device">{(field) => <SameDeviceRule field={field} />}</form.Field>
        <form.Field name="modified">{(field) => <NoModificationsRule field={field} />}</form.Field>
        <form.Field name="strict_timestamp_ordering">
          {(field) => <StrictTimestampOrderingRule field={field} />}
        </form.Field>
      </div>
    </form>
  )
}
