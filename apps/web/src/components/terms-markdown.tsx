import ReactMarkdown from "react-markdown"

type TermsMarkdownProps = {
  markdown: string
}

export function TermsMarkdown({ markdown }: TermsMarkdownProps) {
  return (
    <div className="max-w-none">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="font-rocgrotesk text-2xl font-bold tracking-tight text-foreground first:mt-0 sm:text-[1.65rem]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-10 border-b border-border pb-2 font-rocgrotesk text-xl font-semibold tracking-tight text-foreground first:mt-0 sm:text-[1.35rem]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 font-rocgrotesk text-lg font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-6 font-rocgrotesk text-base font-semibold tracking-tight text-foreground first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[0.9375rem] leading-[1.7] text-foreground/90">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-1.5 pl-5 marker:text-muted-foreground">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-1.5 pl-5 marker:font-medium marker:text-muted-foreground">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-[0.9375rem] leading-relaxed text-foreground/90">{children}</li>,
          a: ({ children, href }) => (
            <a
              href={href}
              className="font-medium text-foreground underline underline-offset-[3px] transition-colors hover:text-muted-foreground"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground/85">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-6 border-l-2 border-border bg-muted/30 py-1 pl-4 pr-2 text-[0.9375rem] not-italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-10 border-border" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
