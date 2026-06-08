'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PrimaryButton } from '@/components/ui/primary-button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useDomain } from '@/lib/domain-provider'
import { useQueryClient, useSuspenseQuery, useMutation } from '@tanstack/react-query'
import { useTRPC } from '@/lib/trpc/client'
import { TermsHeader } from './terms-header'
import { TermsMarkdownPreview } from '../../settings/_components/terms-markdown-preview'
import { parseTermsFile } from '../../_lib/parse-terms-file'
import { cn } from '@/lib/utils'
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard'
import { revalidateTermsPageCache } from '@/lib/terms-page-cache.actions'

const EDITOR_HEIGHT_CLASS = 'min-h-[360px] h-[clamp(360px,calc(100dvh-360px),720px)]'

type EditorMode = 'write' | 'preview'

type TermsEditorProps = {
  domain: string
  currentTerms: string
}

type SaveStatusProps = {
  isDirty: boolean
  isSaving: boolean
  isEmpty: boolean
}

export function TermsContent() {
  const trpc = useTRPC()
  const domain = useDomain()

  const { data: currentTerms } = useSuspenseQuery(
    trpc.marathons.getCurrentTerms.queryOptions({ domain }),
  )

  return (
    <>
      <TermsHeader />
      <TermsEditor key={domain} domain={domain} currentTerms={currentTerms} />
    </>
  )
}

function TermsEditor({ domain, currentTerms }: TermsEditorProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const getTermsUploadUrlMutation = useMutation(trpc.marathons.getTermsUploadUrl.mutationOptions())

  const [termsMarkdown, setTermsMarkdown] = useState(currentTerms)
  const [mode, setMode] = useState<EditorMode>('write')
  const [isUploading, setIsUploading] = useState(false)
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { mutate: updateMarathonSettings, isPending: isUpdating } = useMutation(
    trpc.marathons.update.mutationOptions({
      onSuccess: () => {
        toast.success('Terms and conditions updated successfully')
        void revalidateTermsPageCache(domain)
      },
      onError: (error) => {
        toast.error(error.message || 'Something went wrong')
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.pathKey(),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.marathons.getCurrentTerms.queryKey({ domain }),
        })
      },
    }),
  )

  const trimmedTerms = termsMarkdown.trim()
  const trimmedCurrentTerms = currentTerms.trim()
  const isSaving = isUploading || isUpdating
  const isDirty = trimmedTerms !== trimmedCurrentTerms
  const isEmpty = trimmedTerms.length === 0
  const canSave = isDirty && !isEmpty && !isSaving

  useUnsavedChangesGuard({
    enabled: isDirty,
    message: 'You have unsaved changes to your terms. Leave anyway?',
  })

  const handleTermsUpload = async (file: File): Promise<string | null> => {
    setIsUploading(true)
    try {
      const result = await getTermsUploadUrlMutation.mutateAsync({ domain })
      const { key, url } = result

      await fetch(url as string, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'text/markdown',
        },
      })

      return key
    } catch {
      toast.error('Failed to upload terms and conditions')
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    if (!canSave) return

    const termsFile = new File([termsMarkdown], 'terms-and-conditions.md', {
      type: 'text/markdown',
    })
    const termsKey = await handleTermsUpload(termsFile)
    if (!termsKey) return

    updateMarathonSettings({
      domain,
      data: {
        termsAndConditionsKey: termsKey,
      },
    })
  }

  const applyImportedMarkdown = (markdown: string) => {
    setTermsMarkdown(markdown)
    setMode('write')
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const markdown = await parseTermsFile(file)
      const hasExistingContent = trimmedTerms.length > 0
      const isDifferentContent = markdown.trim() !== trimmedTerms

      if (hasExistingContent && isDifferentContent) {
        setPendingImport(markdown)
      } else {
        applyImportedMarkdown(markdown)
      }
    } catch {
      toast.error('Failed to import terms file')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleConfirmImport = () => {
    if (pendingImport === null) return
    applyImportedMarkdown(pendingImport)
    setPendingImport(null)
  }

  const handleModeChange = (value: string) => {
    setMode(value as EditorMode)
  }

  return (
    <>
      <div className="flex flex-col rounded-xl border bg-card shadow-sm">
        <Tabs value={mode} onValueChange={handleModeChange} className="flex flex-col gap-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">Markdown</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImportClick}
                disabled={isSaving}
              >
                <Upload />
                Import file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.txt,.docx"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <TabsContent
            value="write"
            forceMount
            className={cn('flex flex-col p-0 data-[state=inactive]:hidden', EDITOR_HEIGHT_CLASS)}
          >
            <Textarea
              id="terms-markdown"
              value={termsMarkdown}
              onChange={(e) => setTermsMarkdown(e.target.value)}
              placeholder="# Terms and Conditions&#10;&#10;Write or paste your terms in Markdown…"
              className="min-h-[360px] flex-1 resize-none rounded-none border-0 bg-background font-mono text-sm shadow-none focus-visible:ring-0 [field-sizing:fixed] [scrollbar-gutter:stable]"
            />
          </TabsContent>

          <TabsContent
            value="preview"
            forceMount
            className={cn(
              EDITOR_HEIGHT_CLASS,
              'overflow-y-auto bg-background px-6 py-4 [scrollbar-gutter:stable] data-[state=inactive]:hidden',
            )}
          >
            <TermsMarkdownPreview markdown={termsMarkdown} variant="dialog" />
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-3">
          <SaveStatus isDirty={isDirty} isSaving={isSaving} isEmpty={isEmpty} />
          <PrimaryButton type="button" onClick={handleSave} disabled={!canSave}>
            {isSaving ? 'Saving…' : 'Save Terms'}
          </PrimaryButton>
        </div>
      </div>

      <AlertDialog
        open={pendingImport !== null}
        onOpenChange={(open) => {
          if (!open) setPendingImport(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current terms?</AlertDialogTitle>
            <AlertDialogDescription>
              Importing this file will replace the content you have in the editor. This can&apos;t
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmImport}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function SaveStatus({ isDirty, isSaving, isEmpty }: SaveStatusProps) {
  if (isSaving) {
    return <span className="text-xs text-muted-foreground">Saving changes…</span>
  }
  if (isEmpty) {
    return <span className="text-xs text-muted-foreground">Add content to save</span>
  }
  if (isDirty) {
    return (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
        Unsaved changes
      </span>
    )
  }
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      All changes saved
    </span>
  )
}
