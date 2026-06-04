'use client'

import { FileArchive, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatZipDownloadFilename } from '../_lib/zip-export-phase'
import type { DownloadUrl } from '../_lib/types'

interface ZipDownloadFilesListProps {
  urls: DownloadUrl[]
}

export function ZipDownloadFilesList({ urls }: ZipDownloadFilesListProps) {
  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden">
      {urls.map((item) => {
        const filename = formatZipDownloadFilename(item)
        return (
          <li key={item.zipKey}>
            <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/20 hover:bg-muted/35 transition-colors">
              <FileArchive className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.competitionClassName}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  #{item.minReference}–{item.maxReference} · {filename}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0 text-xs"
                onClick={() => handleDownload(item.downloadUrl, filename)}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
