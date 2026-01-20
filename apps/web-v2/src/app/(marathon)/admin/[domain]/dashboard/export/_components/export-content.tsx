"use client";

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { ExportHeader } from "./export-header";
import { ExportCard } from "./export-card";
import { EXPORT_TYPES } from "../_lib/utils";
import { FullMarathonZipCard } from "./full-marathon-zip-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";

export function ExportContent() {
  const domain = useDomain();
  const trpc = useTRPC();
  const [bypassRestriction, setBypassRestriction] = useState(false);

  const { data: marathon } = useSuspenseQuery(
    trpc.marathons.getByDomain.queryOptions({ domain }),
  );


  const marathonName =
    typeof marathon === "object" && marathon !== null && "name" in marathon
      ? ((marathon as { name?: string | null }).name ?? null)
      : null;

  const isLive = (() => {
    if (!marathon.startDate || !marathon.endDate) return false;
    const now = new Date();
    const startDate = new Date(marathon.startDate);
    const endDate = new Date(marathon.endDate);
    return now >= startDate && now <= endDate;
  })();

  const isDevelopment = process.env.NODE_ENV === "development";
  const shouldDisableExports = isLive && !bypassRestriction;

  if (!marathon) return null;

  return (
    <div className="container mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6">
      <ExportHeader domain={domain} marathonName={marathonName} />
      {isLive && (
        <>
          {isDevelopment && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950">
              <Switch
                id="bypass-export-restriction"
                checked={bypassRestriction}
                onCheckedChange={setBypassRestriction}
              />
              <Label
                htmlFor="bypass-export-restriction"
                className="text-sm font-medium text-amber-900 dark:text-amber-100 cursor-pointer"
              >
                Bypass export restriction (dev only)
              </Label>
            </div>
          )}
          {shouldDisableExports && (
            <Alert className="bg-red-50 border-red-300 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertTitle className="text-red-900 dark:text-red-100">
                Exports unavailable
              </AlertTitle>
              <AlertDescription className="text-red-800 dark:text-red-200">
                Exports are not available while the marathon is live. Please
                wait until the marathon ends to generate exports.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {EXPORT_TYPES.map((exportType) => (
          <ExportCard
            key={exportType.id}
            title={exportType.title}
            description={exportType.description}
            icon={<exportType.icon className="h-5 w-5" />}
            exportType={exportType.exportType}
            accentColor={exportType.accentColor}
            formatOptions={exportType.formatOptions}
            validationOptions={exportType.validationOptions}
            fileFormatOptions={exportType.fileFormatOptions}
            disabled={shouldDisableExports}
          />
        ))}
        <FullMarathonZipCard disabled={shouldDisableExports} />
      </div>
    </div>
  );
}
