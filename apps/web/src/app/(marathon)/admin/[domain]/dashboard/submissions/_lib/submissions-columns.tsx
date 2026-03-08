import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableData } from "../_hooks/use-submissions-table";

function normalizeReference(reference: string): string {
  return reference.trim().toLowerCase();
}

interface SubmissionsColumnsOptions {
  marathonMode?: string;
  participants: TableData[];
  selectedIds: Set<number>;
  onToggleSelection: (id: number, event: React.MouseEvent) => void;
  onToggleAll: () => void;
  uploadProcessorOrderIndexesByReference: ReadonlyMap<
    string,
    ReadonlySet<number>
  >;
  finalizedReferences: ReadonlySet<string>;
}

export const getSubmissionsColumns = ({
  marathonMode,
  participants,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  uploadProcessorOrderIndexesByReference,
  finalizedReferences,
}: SubmissionsColumnsOptions): ColumnDef<TableData>[] => {
  // Calculate select all state based on visible participants
  const visibleIds = participants.map((p) => p.id);
  const selectedVisibleCount = visibleIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;

  const baseColumns: ColumnDef<TableData>[] = [
    {
      id: "select",
      header: () => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={allVisibleSelected}
            data-state={someVisibleSelected ? "indeterminate" : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onToggleAll();
            }}
            aria-label="Select all visible"
          />
        </div>
      ),
      cell: ({ row }) => {
        const participant = row.original;
        const isChecked = selectedIds.has(participant.id);
        return (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isChecked}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection(
                  participant.id,
                  e as unknown as React.MouseEvent,
                );
              }}
              aria-label={`Select participant ${participant.reference}`}
            />
          </div>
        );
      },
      size: 40,
    },
    {
      accessorKey: "reference",
      header: "Reference",
      cell: ({ row }) => (
        <div className="font-semibold text-xs text-foreground">
          {row.getValue("reference")}
        </div>
      ),
    },
    {
      id: "name",
      header: "Name",
      cell: ({ row }) => {
        const firstname = row.original.firstname;
        const lastname = row.original.lastname;
        return (
          <div className="font-medium text-xs">{`${firstname} ${lastname}`}</div>
        );
      },
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.getValue("email") as string | null;
        return (
          <div
            className="text-xs text-muted-foreground truncate max-w-[200px]"
            title={email || undefined}
          >
            {email || "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Initialized At",
      cell: ({ row }) => {
        const createdAt = row.getValue("createdAt") as string;
        const date = new Date(createdAt);
        return (
          <div className="text-xs text-muted-foreground">
            {date.toLocaleString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const rowReference = normalizeReference(row.original.reference);
        const status = finalizedReferences.has(rowReference)
          ? "completed"
          : (row.getValue("status") as string);
        const statusConfig = {
          completed: {
            variant: "default" as const,
            className:
              "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
            icon: CheckCircle2,
          },
          initialized: {
            variant: "outline" as const,
            className:
              "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
            icon: Clock,
          },
          verified: {
            variant: "default" as const,
            className:
              "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
            icon: CheckCircle2,
          },
        };
        const config =
          statusConfig[status as keyof typeof statusConfig] ||
          statusConfig.initialized;
        const Icon = config.icon;
        return (
          <Badge
            variant={config.variant}
            className={cn(
              "capitalize text-xs font-medium gap-1 h-5 px-1.5",
              config.className,
            )}
          >
            <Icon className="size-2.5" />
            {status}
          </Badge>
        );
      },
    },
    {
      id: "uploadProgress",
      header: "Upload",
      cell: ({ row }) => {
        const participant = row.original;
        const expectedFromClass =
          participant.competitionClass?.numberOfPhotos ?? null;
        const expectedCount =
          expectedFromClass !== null && expectedFromClass > 0
            ? expectedFromClass
            : marathonMode === "by-camera"
              ? 1
              : null;

        if (expectedCount === null) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }

        console.log(
          "uploadProcessorOrderIndexesByReference",
          uploadProcessorOrderIndexesByReference,
        );

        const uploadedCount = Math.min(
          uploadProcessorOrderIndexesByReference.get(participant.reference)
            ?.size ??
            uploadProcessorOrderIndexesByReference.get(
              normalizeReference(participant.reference),
            )?.size ??
            0,
          expectedCount,
        );
        const isFinalized = finalizedReferences.has(
          normalizeReference(participant.reference),
        );
        const isCompleted =
          isFinalized ||
          participant.status === "completed" ||
          participant.status === "verified";
        const processedCount = isCompleted ? expectedCount : uploadedCount;

        return (
          <Badge
            variant={processedCount === expectedCount ? "default" : "outline"}
            className={cn(
              "h-5 px-1.5 text-xs font-medium tabular-nums",
              processedCount === expectedCount
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                : "text-muted-foreground",
            )}
          >
            {processedCount}/{expectedCount}
          </Badge>
        );
      },
    },
  ];

  if (marathonMode === "by-camera") {
    baseColumns.push({
      id: "voted",
      header: "Voted",
      cell: ({ row }) => {
        const votedAt = row.original.votingSession?.votedAt;
        if (votedAt) {
          const date = new Date(votedAt);
          return (
            <Badge
              variant="default"
              className="gap-1 text-xs font-medium h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
            >
              <CheckCircle2 className="size-2.5" />
              Voted on{" "}
              {date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </Badge>
          );
        }
        return (
          <Badge
            variant="outline"
            className="gap-1 text-xs font-medium h-5 px-1.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
          >
            <Clock className="size-2.5" />
            Not voted
          </Badge>
        );
      },
    });
  } else {
    baseColumns.push({
      id: "competitionClass",
      header: "Class",
      cell: ({ row }) => {
        const competitionClass = row.original.competitionClass;
        return <div className="text-xs">{competitionClass?.name || "-"}</div>;
      },
    });
  }

  baseColumns.push(
    {
      id: "deviceGroup",
      header: "Device Group",
      cell: ({ row }) => {
        const deviceGroup = row.original.deviceGroup;
        return <div className="text-xs">{deviceGroup?.name || "-"}</div>;
      },
    },
    {
      id: "validationResults",
      header: "Validation Results",
      cell: ({ row }) => {
        const failed = row.original.failedValidationResults;
        const passed = row.original.passedValidationResults;
        const skipped = row.original.skippedValidationResults;
        const failedCount = failed.errors + failed.warnings;
        const passedCount = passed.errors + passed.warnings;
        const skippedCount = skipped.errors + skipped.warnings;
        return (
          <div className="flex items-center gap-1.5">
            {failedCount > 0 && (
              <Badge
                variant="destructive"
                className="gap-1 text-xs font-medium h-5 px-1.5"
              >
                <XCircle className="size-2.5" />
                {failedCount}
              </Badge>
            )}
            {passedCount > 0 && (
              <Badge
                variant="default"
                className="gap-1 text-xs font-medium h-5 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
              >
                <CheckCircle2 className="size-2.5" />
                {passedCount}
              </Badge>
            )}
            {skippedCount > 0 && (
              <Badge
                variant="outline"
                className="gap-1 text-xs font-medium h-5 px-1.5 text-muted-foreground"
              >
                <AlertCircle className="size-2.5" />
                {skippedCount}
              </Badge>
            )}
            {failedCount === 0 && passedCount === 0 && skippedCount === 0 && (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </div>
        );
      },
    },
  );

  return baseColumns;
};
