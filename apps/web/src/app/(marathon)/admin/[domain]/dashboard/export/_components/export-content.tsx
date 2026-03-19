"use client";

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Archive, AlertCircle } from "lucide-react";

import { useTRPC } from "@/lib/trpc/client";
import { useDomain } from "@/lib/domain-provider";
import { getByCameraExportAccessState } from "@/lib/topics/by-camera-export-access-state";
import { ExportHeader } from "./export-header";
import { ExportCard } from "./export-card";
import { BY_CAMERA_EXPORT_TYPES, MARATHON_EXPORT_TYPES } from "../_lib/utils";
import { FullMarathonZipCard } from "./full-marathon-zip-card";
import { TopicImagesZipCard } from "./topic-images-zip-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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
  const isByCamera = marathon.mode === "by-camera";
  const byCameraExportAccess = isByCamera
    ? getByCameraExportAccessState(marathon)
    : null;
  const activeTopic = byCameraExportAccess?.activeTopic ?? null;
  const exportTypes = isByCamera ? BY_CAMERA_EXPORT_TYPES : MARATHON_EXPORT_TYPES;
  const shouldDisableExports = isByCamera
    ? !(byCameraExportAccess?.isExportAllowed ?? false)
    : isLive && !bypassRestriction;

  if (!marathon) return null;

  return (
    <div className="container mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6">
      <ExportHeader domain={domain} marathonName={marathonName} />
      {isByCamera && (
        <Alert>
          <Archive className="h-4 w-4" />
          <AlertTitle>
            {activeTopic ? `Active topic: ${activeTopic.name}` : "By-camera exports"}
          </AlertTitle>
          <AlertDescription>
            Exports on this page are scoped to the active topic only. The ZIP download contains
            the original uploaded images for that topic in one flat archive.
          </AlertDescription>
        </Alert>
      )}
      {!isByCamera && isLive && (
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
        </>
      )}
      {shouldDisableExports ? (
        <Alert className="bg-red-50 border-red-300 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertTitle className="text-red-900 dark:text-red-100">
            {isByCamera ? byCameraExportAccess?.message?.title ?? "Exports unavailable" : "Exports unavailable"}
          </AlertTitle>
          <AlertDescription className="text-red-800 dark:text-red-200">
            {isByCamera
              ? byCameraExportAccess?.message?.description ??
                "Exports are unavailable for the active topic right now."
              : "Exports are not available while the marathon is live. Please wait until the marathon ends to generate exports."}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {exportTypes.map((exportType) => (
          <ExportCard
            key={exportType.id}
            title={exportType.title}
            description={exportType.description}
            icon={<exportType.icon className="h-5 w-5" />}
            exportType={exportType.exportType}
            downloadName={exportType.downloadName}
            accentColor={exportType.accentColor}
            formatOptions={exportType.formatOptions}
            validationOptions={exportType.validationOptions}
            fileFormatOptions={exportType.fileFormatOptions}
            disabled={shouldDisableExports}
          />
        ))}
        {isByCamera ? (
          <TopicImagesZipCard
            disabled={shouldDisableExports}
            topicName={activeTopic?.name ?? null}
          />
        ) : (
          <FullMarathonZipCard disabled={shouldDisableExports} />
        )}
      </div>
    </div>
  );
}
