import type { ComponentProps } from "react";

// An org app card: Frame white (Tank in dark) on the ground, a hairline, 12px, no shadow (docs/brand.md).
export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-border bg-card ${className}`} {...props} />;
}
