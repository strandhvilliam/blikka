"use client"

import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { parseRules, mapRulesToDbRules } from "../_lib/parse-rules"
import { MaxFileSizeRule } from "./max-file-size-rule"
import { AllowedFileTypesRule } from "./allowed-file-types-rule"
import { WithinTimerangeRule } from "./within-timerange-rule"
import { SameDeviceRule } from "./same-device-rule"
import { NoModificationsRule } from "./no-modifications-rule"
import { StrictTimestampOrderingRule } from "./strict-timestamp-ordering-rule"
import { useEffect, useState, useCallback, useMemo } from "react"
import { useAutoSave } from "@/hooks/use-auto-save"
import type { RulesFormValues } from "../_lib/schemas"
import { ShieldCheck, Circle } from "lucide-react"

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

  const enabledCount = Object.values(rules).filter(
    (r) => typeof r === "object" && r !== null && "enabled" in r && r.enabled
  ).length
  const totalCount = Object.keys(rules).length

  return (
    <div>
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10">
            <ShieldCheck className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Validation
            </p>
            <h1 className="text-2xl font-bold tracking-tight font-gothic leading-none">
              Rules
            </h1>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
            Configure validation rules for photo submissions. Changes are saved automatically.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 tabular-nums">
            <div className="flex items-center gap-1">
              <Circle className="h-2 w-2 fill-brand-primary text-brand-primary" />
              <span className="font-medium">{enabledCount}</span>
            </div>
            <span>/</span>
            <span>{totalCount} active</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
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
