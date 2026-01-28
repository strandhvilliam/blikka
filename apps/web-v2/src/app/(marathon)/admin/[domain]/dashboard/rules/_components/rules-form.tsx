"use client"

import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { parseRules, mapRulesToDbRules } from "../_lib/parse-rules"
import { MaxFileSizeRule } from "./max-file-size-rule"
import { AllowedFileTypesRule } from "./allowed-file-types-rule"
import { WithinTimerangeRule } from "./within-timerange-rule"
import { SameDeviceRule } from "./same-device-rule"
import { NoModificationsRule } from "./no-modifications-rule"
import { StrictTimestampOrderingRule } from "./strict-timestamp-ordering-rule"
import { useEffect, useState, useCallback, useMemo } from "react"
import { useAutoSave } from "../_hooks/use-auto-save"
import type { RulesFormValues } from "../_lib/schemas"

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

  const serverRules = useMemo(
    () =>
      parseRules(dbRules, {
        startDate: marathon?.startDate ?? undefined,
        endDate: marathon?.endDate ?? undefined,
      }),
    [dbRules, marathon?.startDate, marathon?.endDate]
  )

  const [rules, setRules] = useState<RulesFormValues>(serverRules)

  const isDirty = useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(serverRules),
    [rules, serverRules]
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
          queryKey: trpc.rules.getByDomain.queryKey({ domain }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.getByDomain.queryKey({ domain }),
        })
      },
    })
  )

  const handleSave = useCallback(
    (value: RulesFormValues) => {
      if (!marathon) {
        return
      }
      updateRules({
        domain,
        data: mapRulesToDbRules(value),
      })
    },
    [domain, marathon, updateRules]
  )

  const { cancelPendingSave, resetToValue } = useAutoSave({
    value: rules,
    onSave: handleSave,
    delay: 500,
    enabled: !!marathon,
  })

  useEffect(() => {
    setRules(serverRules)
    resetToValue(serverRules)
  }, [serverRules, resetToValue])

  const handleReset = useCallback(() => {
    cancelPendingSave()
    setRules(serverRules)
    resetToValue(serverRules)
  }, [cancelPendingSave, serverRules, resetToValue])

  const updateRule = useCallback(
    <K extends keyof RulesFormValues>(key: K, value: RulesFormValues[K]) => {
      setRules((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight font-rocgrotesk">Rules</h1>
          <p className="text-muted-foreground text-sm">
            Configure validation rules for photo submissions. Changes are saved automatically.
          </p>
        </div>
        {/* <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            type="button"
            disabled={!isDirty || isPending}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div> */}
      </div>
      <div className="space-y-4">
        <MaxFileSizeRule
          value={rules.max_file_size}
          onChange={(value) => updateRule("max_file_size", value)}
        />
        <AllowedFileTypesRule
          value={rules.allowed_file_types}
          onChange={(value) => updateRule("allowed_file_types", value)}
        />
        <WithinTimerangeRule
          value={rules.within_timerange}
          onChange={(value) => updateRule("within_timerange", value)}
        />
        <SameDeviceRule
          value={rules.same_device}
          onChange={(value) => updateRule("same_device", value)}
        />
        <NoModificationsRule
          value={rules.modified}
          onChange={(value) => updateRule("modified", value)}
        />
        <StrictTimestampOrderingRule
          value={rules.strict_timestamp_ordering}
          onChange={(value) => updateRule("strict_timestamp_ordering", value)}
        />
      </div>
    </div>
  )
}
