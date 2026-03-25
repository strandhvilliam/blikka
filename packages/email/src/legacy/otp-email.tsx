import React from "react"
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import { Tailwind } from "@react-email/tailwind"

interface OTPEmailProps {
  otp: string
  username?: string
  expiryMinutes?: number
  companyName?: string
  companyLogoUrl?: string
}

export const OTPEmail = ({
  otp,
  username = "",
  expiryMinutes = 10,
  companyName = "Blikka",
  companyLogoUrl = "https://www.blikka.app/blikka-logo-dark.svg",
}: OTPEmailProps) => {
  const previewText = `Your verification code: ${otp}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto my-10 max-w-[600px] rounded-lg bg-white p-8 shadow-lg">
            {companyLogoUrl && (
              <Section className="mb-6 text-center">
                <img src={companyLogoUrl} alt={`${companyName} Logo`} className="mx-auto h-12" />
              </Section>
            )}

            <Heading className="mb-4 text-center text-2xl font-bold text-gray-800">
              Verification Code
            </Heading>

            <Text className="mb-6 text-center text-gray-600">
              {username ? `Hello ${username},` : "Hello,"}
            </Text>

            <Text className="mb-6 text-center text-gray-600">
              Please use the following verification code to complete your authentication:
            </Text>

            <Section className="mb-8 text-center">
              <div className="inline-block rounded-lg bg-gray-100 px-8 py-6">
                <Text className="text-3xl font-bold tracking-widest text-gray-800">
                  {otp.split("").join("")}
                </Text>
              </div>
            </Section>

            <Text className="mb-6 text-center text-sm text-gray-600">
              This code will expire in {expiryMinutes} minutes.
            </Text>

            <Text className="mb-6 text-center text-sm text-gray-600">
              If you didn't request this code, you can safely ignore this email.
            </Text>

            <Hr className="my-6 border-gray-200" />

            <Text className="text-center text-xs text-gray-500">
              &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
            </Text>

            <Text className="text-center text-xs text-gray-500">
              This is an automated message, please do not reply.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
