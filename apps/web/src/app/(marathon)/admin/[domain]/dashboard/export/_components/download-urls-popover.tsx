"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Download, FileArchive } from "lucide-react";
import type { DownloadUrl } from "../_lib/types";

interface DownloadUrlsPopoverProps {
  urls: DownloadUrl[];
}

export function DownloadUrlsPopover({ urls }: DownloadUrlsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <PrimaryButton className="w-full sm:w-auto h-9 px-3 py-1.5">
          <Download className="h-4 w-4" />
          Download
        </PrimaryButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 overflow-visible">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Download Zip Files</h4>
          <div className="space-y-1">
            {urls.map((url) => {
              const filename =
                url.competitionClassName +
                "-" +
                url.minReference +
                "-" +
                url.maxReference +
                ".zip";
              return (
                <button
                  key={url.zipKey}
                  onClick={() => {
                    handleDownload(url.downloadUrl, filename);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded hover:bg-muted transition-colors"
                >
                  <FileArchive className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate flex-1 text-left">
                    {url.competitionClassName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #{url.minReference}-{url.maxReference}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
