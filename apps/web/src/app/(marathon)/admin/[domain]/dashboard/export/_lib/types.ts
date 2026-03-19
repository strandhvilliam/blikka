import { LucideIcon } from "lucide-react";

export interface ProgressData {
  processId: string;
  status: "initializing" | "processing" | "completed" | "failed" | "cancelled";
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  lastUpdatedAt?: string;
  competitionClasses: ReadonlyArray<{
    competitionClassName: string;
    totalChunks: number;
  }>;
}

export interface DownloadUrl {
  competitionClassName: string;
  minReference: number;
  maxReference: number;
  zipKey: string;
  downloadUrl: string;
}

export interface ZipSubmissionStatus {
  totalParticipants: number;
  withZippedSubmissions: number;
  missingReferences: string[];
}


interface SelectOption {
  value: string;
  label: string;
}



export interface ExportTypeConfig {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  exportType: string;
  downloadName?: string;
  accentColor: string;
  formatOptions?: SelectOption[];
  validationOptions?: SelectOption[];
  fileFormatOptions?: SelectOption[];
}