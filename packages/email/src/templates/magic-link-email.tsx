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
} from '@react-email/components'
import { Tailwind } from '@react-email/tailwind'

export interface MagicLinkEmailProps {
  url: string
  email: string
  username?: string
  expiryMinutes?: number
  companyName?: string
  companyLogoUrl?: string
}

export function MagicLinkEmail({
  url,
  email,
  username,
  expiryMinutes = 15,
  companyName = 'Your Company',
  companyLogoUrl,
}: MagicLinkEmailProps) {
  const previewText = `Sign in to ${companyName}`

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
              Sign in to {companyName}
            </Heading>

            <Text className="mb-6 text-center text-gray-600">
              {username ? `Hello ${username},` : 'Hello,'}
            </Text>

            <Text className="mb-6 text-center text-gray-600">
              Click the button below to sign in to your account. This link will expire in{' '}
              {expiryMinutes} minutes.
            </Text>

            <Section className="mb-8 text-center">
              <Button
                href={url}
                className="rounded-lg bg-blue-600 px-8 py-3 text-center text-base font-semibold text-white no-underline"
              >
                Sign In
              </Button>
            </Section>

            <Text className="mb-6 text-center text-sm text-gray-600">
              Or copy and paste this link into your browser:
            </Text>

            <Section className="mb-6 text-center">
              <Link href={url} className="break-all text-sm text-blue-600 underline">
                {url}
              </Link>
            </Section>

            <Text className="mb-6 text-center text-sm text-gray-600">
              If you didn't request this sign-in link, you can safely ignore this email.
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
