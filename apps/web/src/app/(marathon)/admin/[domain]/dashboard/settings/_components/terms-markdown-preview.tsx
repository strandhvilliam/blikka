import React from "react"
import ReactMarkdown from "react-markdown"

interface TermsMarkdownPreviewProps {
  markdown: string
}

export function TermsMarkdownPreview({ markdown }: TermsMarkdownPreviewProps) {
  return (
    <div className="w-[440px] max-h-[580px] relative overflow-y-auto bg-background border border-border rounded-2xl shadow-lg">
      {markdown.trim() ? (
        <div className="prose prose-sm max-w-none dark:prose-invert p-2">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-base font-gothic font-bold mb-2">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-sm font-gothic font-semibold mb-2">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-xs font-gothic font-semibold mb-1">{children}</h3>
              ),
              p: ({ children }) => <p className="text-xs mb-2">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
              li: ({ children }) => <li className="text-xs">{children}</li>,
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
        <p className="text-xs text-muted-foreground">No terms content yet.</p>
      )}
    </div>
  )
}
