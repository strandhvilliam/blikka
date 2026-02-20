"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { useTRPC } from "@/lib/trpc/client"
import { useDomain } from "@/lib/domain-provider"

export function SmsTestSection() {
  const trpc = useTRPC()
  const domain = useDomain()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [message, setMessage] = useState("")

  const { mutate: sendTestSMS, isPending: isSending } = useMutation(
    trpc.sms.sendTest.mutationOptions({
      onSuccess: (data) => {
        toast.success(`SMS sent successfully! Message ID: ${data.messageId}`)
        setPhoneNumber("")
        setMessage("")
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send SMS")
      },
    }),
  )

  const handleSend = () => {
    sendTestSMS({ phoneNumber, message })
  }
  return (
    <div className="mt-6 bg-muted/30 border border-muted rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-medium font-gothic">SMS Test</h3>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
          Admin Only
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Send a test SMS message to verify the SMS service is working correctly.
      </p>
      <div className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="sms-phone">Phone Number</Label>
          <Input
            id="sms-phone"
            name="sms-phone"
            type="tel"
            placeholder="+1234567890"
            autoComplete="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sms-message">Message</Label>
          <Textarea
            id="sms-message"
            name="sms-message"
            placeholder="Enter test message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={160}
            className="min-h-[80px]"
          />
          <div className="text-xs text-muted-foreground text-right tabular-nums">
            {message.length}/160
          </div>
        </div>
        <Button
          type="button"
          onClick={handleSend}
          disabled={isSending || !phoneNumber || !message}
        >
          {isSending ? "Sending…" : "Send Test SMS"}
        </Button>
      </div>
    </div>
  )
}
