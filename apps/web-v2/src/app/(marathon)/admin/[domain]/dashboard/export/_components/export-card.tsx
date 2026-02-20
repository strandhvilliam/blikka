"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

interface SelectOption {
  value: string
  label: string
}

interface ExportCardProps {
  title: string
  description: string
  icon: React.ReactNode
  exportType: string
  formatOptions?: SelectOption[]
  validationOptions?: SelectOption[]
  fileFormatOptions?: SelectOption[]
  accentColor?: string
  disabled?: boolean
}

function getFileExtension(exportType: string, format: string, fileFormat: string): string {
  if (exportType === "exif") return format || "json"
  if (exportType === "txt_validation_results") return fileFormat === "folder" ? "zip" : "txt"
  return "xlsx"
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "").trim()
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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

async function downloadFile(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { method: "GET" })

  if (!response.ok) throw new Error("Export failed")

  const blob = await response.blob()
  const downloadUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = downloadUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  window.URL.revokeObjectURL(downloadUrl)
  document.body.removeChild(anchor)
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
  formatOptions,
  validationOptions,
  fileFormatOptions,
  accentColor = "hsl(var(--primary))",
  disabled = false,
}: ExportCardProps) {
  const domain = useDomain()
  const [isLoading, setIsLoading] = useState(false)
  const [format, setFormat] = useState(formatOptions?.[0]?.value || "")
  const [onlyFailed, setOnlyFailed] = useState(validationOptions?.[0]?.value === "failed")
  const [fileFormat, setFileFormat] = useState(fileFormatOptions?.[0]?.value || "single")

  const hasOptions = formatOptions || validationOptions || fileFormatOptions
  const extension = getFileExtension(exportType, format, fileFormat).toUpperCase()

  const accentBg =
    typeof accentColor === "string" && accentColor.startsWith("#")
      ? hexToRgba(accentColor, 0.12)
      : "hsl(var(--muted) / 0.6)"

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
      const filename = `${exportType}-export-${new Date().toISOString().split("T")[0]}.${exportExtension}`

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
    format,
    onlyFailed,
    fileFormat,
    formatOptions,
    validationOptions,
    fileFormatOptions,
    title,
  ])

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-200 py-6!",
      disabled 
        ? "opacity-50 cursor-not-allowed" 
        : "hover:shadow-md"
    )}>
      <CardHeader className="space-y-0 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                "ring-1 ring-border text-muted-foreground"
              )}
              style={{ background: accentBg ? accentBg : undefined }}
            >
              {icon}
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold font-gothic leading-none">{title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {description}
              </p>
            </div>
          </div>

          <Badge variant="secondary" className="rounded-full">
            {extension}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasOptions ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {formatOptions ? (
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
            ) : null}

            {validationOptions ? (
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
            ) : null}

            {fileFormatOptions ? (
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
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Exports are generated on demand and may take a few seconds.
          </p>
          <PrimaryButton
            onClick={handleExport}
            disabled={isLoading || disabled}
            className="w-full sm:w-auto h-9 px-3 py-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download
              </>
            )}
          </PrimaryButton>
        </div>
      </CardContent>
    </Card>
  )
}
