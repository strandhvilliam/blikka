import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="text-[1.375rem] leading-7 font-semibold tracking-[-0.02em] wrap-anywhere">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </header>
  );
}
