"use client"

import React from "react"
import { format } from "date-fns"
import { ChevronRight, Info, Camera } from "lucide-react"
import type { Marathon } from "@blikka/db"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PrimaryButton } from "@/components/ui/primary-button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import ReactMarkdown from "react-markdown"

export function SettingsPhonePreview({ marathon }: { marathon: Marathon }) {
  return (
    <div className="w-[340px] max-h-[680px] relative border-8 border-muted rounded-3xl overflow-y-auto shadow-2xl flex flex-col bg-background">
      <div className="flex-1 relative">
        <header className="flex flex-col items-center pt-16 pb-4 px-4">
          <div className="w-24 h-24 rounded-full overflow-hidden mb-3 flex items-center justify-center">
            {marathon.logoUrl ? (
              <img
                src={marathon.logoUrl}
                alt="Marathon logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                <Camera className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-center font-gothic">
            {marathon.name || "Stockholm Fotomaraton"}
          </h1>
          <p className="text-center text-lg mt-1 font-medium tracking-wide">
            {marathon.startDate
              ? format(new Date(marathon.startDate), "d MMMM yyyy")
              : "16 August 2025"}
          </p>
        </header>

        <main className="flex-1 w-11/12 mx-auto pb-6 flex flex-col justify-end">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 border border-background/20 shadow-xl">
            <h2 className="text-lg font-semibold mb-4 font-gothic">Getting Started</h2>

            <section className="mb-5">
              <label className="block text-xs font-medium mb-2">Choose Language</label>
              <div className="flex flex-col gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-foreground text-xs"
                >
                  <span>🇬🇧</span>
                  English
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 text-xs"
                >
                  <span>🇸🇪</span>
                  Svenska
                </Button>
              </div>
            </section>

            <section className="mb-5">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="rules" className="border-gray-200">
                  <AccordionTrigger className="font-semibold text-xs py-3">
                    <div className="flex items-center gap-2 font-medium">
                      <Info size={16} />
                      Competition Rules & Info
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-xs font-medium space-y-2">
                    {marathon.description ? (
                      <div className="markdown-content">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => (
                              <p className="text-xs font-medium mb-1">{children}</p>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc pl-4 space-y-0.5 mb-1">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal pl-4 space-y-0.5 mb-1">{children}</ol>
                            ),
                            li: ({ children }) => (
                              <li className="text-xs font-medium">{children}</li>
                            ),
                            h1: ({ children }) => (
                              <h1 className="text-sm font-gothic font-bold mb-1">{children}</h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-xs font-gothic font-semibold mb-1">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-xs font-gothic font-semibold mb-0.5">
                                {children}
                              </h3>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-bold">{children}</strong>
                            ),
                            em: ({ children }) => <em className="italic">{children}</em>,
                            a: ({ children, href }) => (
                              <a
                                href={href}
                                className="underline text-blue-600 hover:text-blue-800"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {marathon.description}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-muted-foreground italic">
                        No info added by the organizer
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>

            <section className="mb-6">
              <div className="flex items-start space-x-2">
                <Checkbox id="terms" className="mt-1" />
                <label htmlFor="terms" className="text-xs font-medium">
                  I accept the <span className="underline font-semibold">terms and conditions</span>
                </label>
              </div>
            </section>

            <PrimaryButton className="w-full py-2 text-xs text-white rounded-full">
              Begin
              <ChevronRight className="ml-2 h-5 w-5" />
            </PrimaryButton>
          </div>
        </main>
      </div>
    </div>
  )
}
