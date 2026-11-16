import type { Icon } from "@tabler/icons-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: Icon;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-12 text-center">
      <span className="mb-3 grid size-10 place-items-center rounded-[10px] border border-border bg-card text-muted-foreground">
        <Icon aria-hidden className="size-5" stroke={1.5} />
      </span>
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-balance text-muted-foreground">{description}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// A count beside a card's title, like "4" or "1/3".
export function Count({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[6px] bg-muted px-1.5 py-px font-mono text-[0.6875rem] text-muted-foreground">
      {children}
    </span>
  );
}
