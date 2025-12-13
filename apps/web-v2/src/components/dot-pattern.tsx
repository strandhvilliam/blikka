import { cn } from "@/lib/utils"

export function DotPattern({ className }: { className?: string }) {
  return (
    <>
      <div
        className={cn(
          "absolute -z-10 inset-0 pointer-events-none opacity-70 dark:opacity-0 bg-dot-pattern-light",
          className
        )}
      />
      <div
        className={cn(
          "absolute -z-10 inset-0 opacity-0 dark:opacity-70 pointer-events-none bg-dot-pattern-dark",
          className
        )}
      />
    </>
  )
}
