"use client"

import { useEffect, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useDomain } from "@/lib/domain-provider"
import { useQueryClient, useSuspenseQuery, useMutation } from "@tanstack/react-query"
import { useTRPC } from "@/lib/trpc/client"
import { TermsHeader } from "./terms-header"
import { TermsImportField } from "../../settings/_components/terms-import-field"

export function TermsContent() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()

  useSuspenseQuery(trpc.marathons.getByDomain.queryOptions({ domain }))

  const { data: currentTerms } = useSuspenseQuery(
    trpc.marathons.getCurrentTerms.queryOptions({ domain }),
  )

  const getTermsUploadUrlMutation = useMutation(trpc.marathons.getTermsUploadUrl.mutationOptions())

  const [termsMarkdown, setTermsMarkdown] = useState(currentTerms)
  const [hasChanged, setHasChanged] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const prevDomainRef = useRef<string | null>(null)

  useEffect(() => {
    if (prevDomainRef.current !== domain) {
      prevDomainRef.current = domain
      setTermsMarkdown(currentTerms)
      setHasChanged(false)
    }
  }, [domain, currentTerms])

  const { mutate: updateMarathonSettings, isPending: isUpdating } = useMutation(
    trpc.marathons.update.mutationOptions({
      onSuccess: () => {
        toast.success("Terms and conditions updated successfully")
        setHasChanged(false)
      },
      onError: (error) => {
        toast.error(error.message || "Something went wrong")
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

  const handleTermsUpload = async (file: File): Promise<string | null> => {
    setIsUploading(true)

    try {
      const result = await getTermsUploadUrlMutation.mutateAsync({ domain })
      const { key, url } = result

      await fetch(url as string, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "text/markdown",
        },
      })

      return key
    } catch {
      toast.error("Failed to upload terms and conditions")
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    if (!hasChanged || !termsMarkdown.trim()) return

    const termsFile = new File([termsMarkdown], "terms-and-conditions.md", {
      type: "text/markdown",
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

  return (
    <div>
      <TermsHeader
        markdown={termsMarkdown}
        onSave={handleSave}
        saveDisabled={!hasChanged || !termsMarkdown.trim() || isUploading || isUpdating}
        isSaving={isUploading || isUpdating}
      />

      <section>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="terms-markdown">Terms and Conditions</Label>
              <span className="text-xs text-muted-foreground">Markdown only</span>
            </div>
            <Textarea
              id="terms-markdown"
              value={termsMarkdown}
              onChange={(e) => {
                setTermsMarkdown(e.target.value)
                setHasChanged(true)
              }}
              className="min-h-[320px] max-h-[min(520px,55vh)] bg-background font-mono text-sm"
            />
          </div>

          <TermsImportField
            onMarkdownImported={(markdown) => {
              setTermsMarkdown(markdown)
              setHasChanged(true)
            }}
          />
        </div>
      </section>
    </div>
  )
}
