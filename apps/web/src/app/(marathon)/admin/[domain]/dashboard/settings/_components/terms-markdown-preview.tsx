import React from "react"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"

interface TermsMarkdownPreviewProps {
  markdown: string
  variant?: "default" | "dialog"
}

export function TermsMarkdownPreview({
  markdown,
  variant = "default",
}: TermsMarkdownPreviewProps) {
  return (
    <div
      className={cn(
        "relative bg-background border border-border",
        variant === "default" &&
          "w-[440px] max-h-[580px] overflow-y-auto rounded-2xl shadow-lg",
        variant === "dialog" && "w-full rounded-lg border-dashed",
      )}
    >
      {markdown.trim() ? (
        <div
          className={cn(
            "prose max-w-none dark:prose-invert",
            variant === "default" && "prose-sm p-2",
            variant === "dialog" && "prose-base sm:prose-lg px-4 py-3",
          )}
        >
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1
                  className={cn(
                    "font-gothic font-bold mb-2",
                    variant === "default" ? "text-base" : "text-xl sm:text-2xl",
                  )}
                >
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2
                  className={cn(
                    "font-gothic font-semibold mb-2",
                    variant === "default" ? "text-sm" : "text-lg sm:text-xl",
                  )}
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3
                  className={cn(
                    "font-gothic font-semibold mb-1",
                    variant === "default" ? "text-xs" : "text-base sm:text-lg",
                  )}
                >
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className={cn("mb-2", variant === "default" ? "text-xs" : "text-sm sm:text-base")}>
                  {children}
                </p>
              ),
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
              li: ({ children }) => (
                <li className={variant === "default" ? "text-xs" : "text-sm sm:text-base"}>
                  {children}
                </li>
              ),
              a: ({ children, href }) => (
                <a href={href} className="underline text-blue-600 hover:text-blue-800">
                  {children}
                </a>
              ),
              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      ) : (
        <p
          className={cn(
            "text-muted-foreground",
            variant === "default" ? "text-xs" : "text-sm px-4 py-6",
          )}
        >
          No terms content yet.
        </p>
      )}
    </div>
  )
}
