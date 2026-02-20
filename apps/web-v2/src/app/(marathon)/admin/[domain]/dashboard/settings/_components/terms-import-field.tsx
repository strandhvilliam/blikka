"use client"

import { useRef, useState } from "react"
import { FileText, X } from "lucide-react"
import { Label } from "@/components/ui/label"
import mammoth from "mammoth"
import TurndownService from "turndown"
import { toast } from "sonner"

interface TermsImportFieldProps {
  onMarkdownImported: (markdown: string) => void
}

async function parseTermsFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase()

  if (extension === "md" || extension === "txt") {
    return file.text()
  }

  if (extension === "docx") {
    const arrayBuffer = await file.arrayBuffer()
    const { value } = await mammoth.convertToHtml({ arrayBuffer })
    const turndownService = new TurndownService()
    return turndownService.turndown(value || "")
  }

  throw new Error("Unsupported file type")
}

export function TermsImportField({
  onMarkdownImported,
}: TermsImportFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const markdown = await parseTermsFile(file)
      setFileName(file.name)
      onMarkdownImported(markdown)
    } catch {
      toast.error("Failed to import terms file")
    }
  }

  const handleRemove = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    setFileName(null)
  }
  return (
    <div className="space-y-2">
      <Label>Import file (optional)</Label>
      <div className="relative">
        <input
          type="file"
          accept=".md,.txt,.docx"
          ref={fileInputRef}
          className="hidden"
          id="terms-upload"
          onChange={handleFileChange}
        />
        {fileName ? (
          <div className="flex items-center gap-3">
            <div className="w-[42px] h-[42px] rounded-full bg-muted flex items-center justify-center shrink-0">
              <FileText
                className="h-5 w-5 text-muted-foreground"
                aria-hidden
              />
            </div>
            <div className="w-full flex-1 relative h-[42px] rounded-lg overflow-hidden border bg-background flex items-center justify-between gap-3">
              <div className="flex items-center justify-between h-full flex-1 pr-3">
                <div className="flex items-center gap-2 px-3 h-full">
                  <span className="text-sm">{fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="flex items-center gap-2 px-3 h-full hover:bg-muted rounded-md text-foreground hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Remove imported file"
                >
                  <X className="h-4 w-4" aria-hidden />
                  <span className="text-sm">Remove</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-[42px] h-[42px] rounded-full bg-muted flex items-center justify-center shrink-0">
              <FileText
                className="h-5 w-5 text-muted-foreground"
                aria-hidden
              />
            </div>
            <label
              htmlFor="terms-upload"
              className="px-4 w-full flex items-center h-[42px] rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/50 bg-background transition-colors cursor-pointer gap-3"
            >
              <div className="flex items-center justify-between flex-1">
                <span className="text-sm text-muted-foreground">
                  Import .md, .txt, or .docx…
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  DOCX, TXT, MD • 2MB max
                </span>
              </div>
            </label>
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        Imported content is converted to Markdown and placed in the editor.
      </div>
    </div>
  )
}
