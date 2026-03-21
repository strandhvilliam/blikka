"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Loader2 } from "lucide-react"
import { useState, useCallback } from "react"
import { useDomain } from "@/lib/domain-provider"
import { toast } from "sonner"
import { PrimaryButton } from "@/components/ui/primary-button"
import { cn } from "@/lib/utils"
import { downloadFile } from "../_lib/download-file"

interface SelectOption {
  value: string
  label: string
}

interface ExportCardProps {
  title: string
  description: string
  icon: React.ReactNode
  exportType: string
  downloadName?: string
  formatOptions?: SelectOption[]
  validationOptions?: SelectOption[]
  fileFormatOptions?: SelectOption[]
  disabled?: boolean
}

function getFileExtension(exportType: string, format: string, fileFormat: string): string {
  if (exportType === "exif") return format || "json"
  if (exportType.startsWith("txt_validation_results")) {
    return fileFormat === "folder" ? "zip" : "txt"
  }
  return "xlsx"
}

function buildExportUrl(
  domain: string,
  exportType: string,
  options: {
    format?: string
    onlyFailed?: boolean
    fileFormat?: string
    formatOptions?: SelectOption[]
    validationOptions?: SelectOption[]
    fileFormatOptions?: SelectOption[]
  }
): string {
  const params = new URLSearchParams()

  if (options.formatOptions && options.format) {
    params.append("format", options.format)
  }

  if (options.validationOptions && options.onlyFailed !== undefined) {
    params.append("onlyFailed", options.onlyFailed.toString())
  }

  if (options.fileFormatOptions && options.fileFormat) {
    params.append("fileFormat", options.fileFormat)
  }

  const queryString = params.toString()
  return `/api/${domain}/export/${exportType}${queryString ? `?${queryString}` : ""}`
}

function ExportSelect({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  disabled,
}: {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder: string
  id: string
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full" id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ExportCard({
  title,
  description,
  icon,
  exportType,
  downloadName,
  formatOptions,
  validationOptions,
  fileFormatOptions,
  disabled = false,
}: ExportCardProps) {
  const domain = useDomain()
  const [isLoading, setIsLoading] = useState(false)
  const [format, setFormat] = useState(formatOptions?.[0]?.value || "")
  const [onlyFailed, setOnlyFailed] = useState(validationOptions?.[0]?.value === "failed")
  const [fileFormat, setFileFormat] = useState(fileFormatOptions?.[0]?.value || "single")

  const hasOptions = formatOptions || validationOptions || fileFormatOptions
  const extension = getFileExtension(exportType, format, fileFormat).toUpperCase()

  const handleExport = useCallback(async () => {
    try {
      setIsLoading(true)

      const url = buildExportUrl(domain, exportType, {
        format,
        onlyFailed,
        fileFormat,
        formatOptions,
        validationOptions,
        fileFormatOptions,
      })

      const exportExtension = getFileExtension(exportType, format, fileFormat)
      const filenameBase = downloadName ?? exportType
      const filename = `${filenameBase}-export-${new Date().toISOString().split("T")[0]}.${exportExtension}`

      await downloadFile(url, filename)

      toast.success("Export successful", {
        description: `Your ${title} data has been downloaded.`,
      })
    } catch {
      toast.error("Export failed", {
        description: "There was an error exporting the data. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }, [
    domain,
    exportType,
    downloadName,
    format,
    onlyFailed,
    fileFormat,
    formatOptions,
    validationOptions,
    fileFormatOptions,
    title,
  ])

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-white transition-shadow duration-200",
        disabled
          ? "border-border/60 opacity-60 cursor-not-allowed"
          : "border-border hover:border-border/80 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]"
      )}
    >
      <div className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground/60">
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground/70">
                {title}
              </h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                {description}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {extension}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-5 mb-5 pt-4 border-t border-border/50">
        {hasOptions && (
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            {formatOptions && (
              <div className="space-y-1.5">
                <Label htmlFor={`${exportType}-format`} className="text-xs text-muted-foreground">
                  Format
                </Label>
                <ExportSelect
                  id={`${exportType}-format`}
                  value={format}
                  onValueChange={setFormat}
                  options={formatOptions}
                  placeholder="Choose a format"
                  disabled={disabled}
                />
              </div>
            )}

            {validationOptions && (
              <div className="space-y-1.5">
                <Label htmlFor={`${exportType}-scope`} className="text-xs text-muted-foreground">
                  Scope
                </Label>
                <ExportSelect
                  id={`${exportType}-scope`}
                  value={onlyFailed ? "failed" : "all"}
                  onValueChange={(value) => setOnlyFailed(value === "failed")}
                  options={validationOptions}
                  placeholder="Choose scope"
                  disabled={disabled}
                />
              </div>
            )}

            {fileFormatOptions && (
              <div className="space-y-1.5">
                <Label htmlFor={`${exportType}-output`} className="text-xs text-muted-foreground">
                  Output
                </Label>
                <ExportSelect
                  id={`${exportType}-output`}
                  value={fileFormat}
                  onValueChange={setFileFormat}
                  options={fileFormatOptions}
                  placeholder="Choose output format"
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground/70">
            Generated on demand. May take a few seconds.
          </p>
          <PrimaryButton
            onClick={handleExport}
            disabled={isLoading || disabled}
            className="shrink-0 h-8 px-3 text-xs"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download
              </>
            )}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
