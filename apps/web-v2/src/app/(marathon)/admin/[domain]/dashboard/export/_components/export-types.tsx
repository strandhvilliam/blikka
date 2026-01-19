import { FileSpreadsheet, ClipboardCheck, Archive } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface ExportTypeConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  exportType: string;
  accentColor: string;
  formatOptions?: SelectOption[];
  validationOptions?: SelectOption[];
  fileFormatOptions?: SelectOption[];
}

export const EXPORT_TYPES: ExportTypeConfig[] = [
  {
    id: "participants",
    title: "Participants",
    description:
      "Contact details, competition class, and device group for all registered participants.",
    icon: <FileSpreadsheet className="h-5 w-5" />,
    exportType: "xlsx_participants",
    accentColor: "#10b981", // emerald
  },
  {
    id: "submissions",
    title: "Submissions",
    description:
      "Upload times, status, and validation results for all photo submissions.",
    icon: <FileSpreadsheet className="h-5 w-5" />,
    exportType: "xlsx_submissions",
    accentColor: "#3b82f6", // blue
  },
  {
    id: "validation",
    title: "Validation Results",
    description:
      "Detailed validation outcomes showing which submissions passed or failed rules.",
    icon: <ClipboardCheck className="h-5 w-5" />,
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
  {
    id: "full_marathon_zip",
    title: "Full Marathon Zip",
    description:
      "Generate a complete zip archive of all participant submissions.",
    icon: <Archive className="h-5 w-5" />,
    exportType: "full_marathon_zip",
    accentColor: "#8b5cf6", // violet
  },
];
