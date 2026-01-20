import { FileSpreadsheet, ClipboardCheck, Archive, type LucideIcon } from "lucide-react";
import { type ExportTypeConfig } from "./types";

export const EXPORT_TYPES: ExportTypeConfig[] = [
  {
    id: "participants",
    title: "Participants",
    description:
      "Contact details, competition class, and device group for all registered participants.",
    icon: FileSpreadsheet,
    exportType: "xlsx_participants",
    accentColor: "#10b981", // emerald
  },
  {
    id: "submissions",
    title: "Submissions",
    description:
      "Upload times, status, and validation results for all photo submissions.",
    icon: FileSpreadsheet,
    exportType: "xlsx_submissions",
    accentColor: "#3b82f6", // blue
  },
  {
    id: "validation",
    title: "Validation Results",
    description:
      "Detailed validation outcomes showing which submissions passed or failed rules.",
    icon: ClipboardCheck,
    exportType: "txt_validation_results",
    accentColor: "#f59e0b", // amber
    validationOptions: [
      { value: "failed", label: "Failed Only" },
      { value: "all", label: "All Results" },
    ],
    fileFormatOptions: [
      { value: "single", label: "Single File" },
      { value: "folder", label: "Per Participant (ZIP)" },
    ],
  },
];
