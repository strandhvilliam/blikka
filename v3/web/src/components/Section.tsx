import type { ReactNode } from "react";
import { Card } from "./Card.tsx";

export function Saved() {
  return (
    <p role="status" className="me-auto flex items-center gap-2 text-sm">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-leaf" />
      Saved
    </p>
  );
}

export function Section({
  title,
  description,
  aside,
  footer,
  children,
  tone,
}: {
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  tone?: "danger";
}) {
  return (
    <Card className={`overflow-hidden ${tone === "danger" ? "border-destructive/30" : ""}`}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 px-5 pt-4 pb-4">
        <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
      </div>
      {children && <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>}
      {footer && (
        <div
          className={`flex min-h-12 flex-wrap items-center justify-end gap-3 border-t px-5 py-2.5 ${tone === "danger" ? "border-destructive/20 bg-destructive/5" : "border-border bg-page"}`}
        >
          {footer}
        </div>
      )}
    </Card>
  );
}
