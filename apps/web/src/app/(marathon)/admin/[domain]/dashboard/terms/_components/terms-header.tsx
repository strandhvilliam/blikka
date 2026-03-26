"use client"

import { useState } from "react"
import { Eye, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PrimaryButton } from "@/components/ui/primary-button"
import { TermsMarkdownPreview } from "../../settings/_components/terms-markdown-preview"

interface TermsHeaderProps {
  markdown: string
  onSave: () => void
  saveDisabled: boolean
  isSaving: boolean
}

export function TermsHeader({ markdown, onSave, saveDisabled, isSaving }: TermsHeaderProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <>
      <div className="mb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10">
              <FileText className="h-[18px] w-[18px] text-brand-primary" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Legal
              </p>
              <h1 className="font-gothic text-2xl font-bold leading-none tracking-tight">
                Terms & Conditions
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:mt-1">
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
              <Eye />
              Preview
            </Button>
            <PrimaryButton type="button" onClick={onSave} disabled={saveDisabled}>
              {isSaving ? "Saving…" : "Save Terms"}
            </PrimaryButton>
          </div>
        </div>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Manage the terms and conditions participants must accept before joining your marathon.
        </p>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          size="xl"
          className="flex max-h-[min(92dvh,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        >
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
            <DialogTitle>Terms preview</DialogTitle>
            <DialogDescription>
              How this markdown will look to participants.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <TermsMarkdownPreview markdown={markdown} variant="dialog" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
