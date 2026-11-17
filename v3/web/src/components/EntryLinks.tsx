import { IconCheck, IconCopy, IconExternalLink, IconQrcode } from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import type { Competition } from "@/api/competitions.ts";

const iconButton = "size-8 border-transparent bg-transparent p-0 text-muted-foreground hover:text-foreground";

export function EntryLinks({ competition }: { competition: Competition }) {
  const [copied, setCopied] = useState(false);
  const path = `/e/${competition.slug}`;

  if (!competition.published_at) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button className="h-8 no-underline max-sm:hidden" render={<a href={path} target="_blank" rel="noreferrer" />}>
        Entry page
        <IconExternalLink aria-hidden className="text-muted-foreground" />
      </Button>
      <Button
        aria-label={copied ? "Entry link copied" : "Copy entry link"}
        title="Copy entry link"
        className={iconButton}
        onClick={() =>
          navigator.clipboard.writeText(window.location.origin + path).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
        }
      >
        {copied ? <IconCheck aria-hidden /> : <IconCopy aria-hidden />}
      </Button>
      <Dialog>
        <DialogTrigger aria-label="Entry QR code" title="Entry QR code" className={iconButton}>
          <IconQrcode aria-hidden />
        </DialogTrigger>
        <DialogBackdrop />
        <DialogContent className="items-start">
          <DialogTitle>Entry QR code</DialogTitle>
          <DialogDescription>Participants scan it to open the entry page.</DialogDescription>
          <QRCodeSVG
            value={window.location.origin + path}
            size={240}
            marginSize={2}
            className="size-60 shrink-0 self-center"
          />
          <p className="self-center font-mono text-xs wrap-anywhere text-muted-foreground">
            {window.location.host}
            {path}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
