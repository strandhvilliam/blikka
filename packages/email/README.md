# @vimmer/email

Effect-TS service for sending emails using Resend and React Email templates.

## Features

- 🎯 **Effect-TS Integration**: Built using the Effect.Service pattern for composable, type-safe email operations
- 📧 **React Email Templates**: Create beautiful, responsive email templates with React components
- 🚀 **Resend Integration**: Reliable email delivery through Resend's API
- 🔄 **Batch Sending**: Send multiple emails efficiently in a single operation
- 🎨 **Type-Safe**: Full TypeScript support with proper error handling
- 🔌 **Composable**: Easy to integrate with other Effect services

## Installation

```bash
bun add @vimmer/email
```

## Quick Start

### 1. Basic Usage

```typescript
import { Effect } from "effect"
import { EmailService, makeEmailServiceLayer, sendTemplate } from "@vimmer/email"
import { OTPEmail } from "@vimmer/email/templates/otp-email"

// Create the email service layer
const emailLayer = makeEmailServiceLayer({
  apiKey: process.env.RESEND_API_KEY!,
  defaultFrom: "support@example.com",
})

// Send an email
const program = sendTemplate({
  to: "user@example.com",
  subject: "Your verification code",
  template: OTPEmail({
    otp: "123456",
    username: "John Doe",
    expiryMinutes: 10,
  }),
})

// Run the program
const result = await Effect.runPromise(program.pipe(Effect.provide(emailLayer)))

console.log(`Email sent with ID: ${result.id}`)
```

### 2. Using the Service Directly

```typescript
import { Effect } from "effect"
import { EmailService, makeEmailServiceLayer } from "@vimmer/email"
import { OTPEmail } from "@vimmer/email/templates/otp-email"

const program = Effect.gen(function* () {
  const emailService = yield* EmailService

  const result = yield* emailService.send({
    to: "user@example.com",
    subject: "Your verification code",
    template: OTPEmail({
      otp: "123456",
      username: "John Doe",
    }),
  })

  return result
})

const emailLayer = makeEmailServiceLayer({
  apiKey: process.env.RESEND_API_KEY!,
  defaultFrom: "support@example.com",
})

await Effect.runPromise(program.pipe(Effect.provide(emailLayer)))
```

### 3. Batch Sending

```typescript
import { Effect } from "effect"
import { sendTemplateBatch, makeEmailServiceLayer } from "@vimmer/email"
import { OTPEmail } from "@vimmer/email/templates/otp-email"

const program = sendTemplateBatch([
  {
    to: "user1@example.com",
    subject: "Your verification code",
    template: OTPEmail({ otp: "123456", username: "User 1" }),
  },
  {
    to: "user2@example.com",
    subject: "Your verification code",
    template: OTPEmail({ otp: "789012", username: "User 2" }),
  },
])

const emailLayer = makeEmailServiceLayer({
  apiKey: process.env.RESEND_API_KEY!,
})

const results = await Effect.runPromise(program.pipe(Effect.provide(emailLayer)))

console.log(`Sent ${results.length} emails`)
```

### 4. Error Handling

```typescript
import { Effect } from "effect"
import { sendTemplate, makeEmailServiceLayer } from "@vimmer/email"
import { OTPEmail } from "@vimmer/email/templates/otp-email"

const program = sendTemplate({
  to: "user@example.com",
  subject: "Your verification code",
  template: OTPEmail({ otp: "123456" }),
}).pipe(
  Effect.catchTag("EmailError", (error) =>
    Effect.gen(function* () {
      console.error("Failed to send email:", error.message)
      // Handle the error (e.g., log to monitoring service)
      return { id: "failed" }
    }),
  ),
)

const emailLayer = makeEmailServiceLayer({
  apiKey: process.env.RESEND_API_KEY!,
})

await Effect.runPromise(program.pipe(Effect.provide(emailLayer)))
```

### 5. Creating Reusable Template Senders

```typescript
import { createTemplateSender } from "@vimmer/email"
import { OTPEmail, type OTPEmailProps } from "@vimmer/email/templates/otp-email"

// Create a reusable OTP email sender
const sendOTPEmail = createTemplateSender(
  OTPEmail,
  (props: OTPEmailProps) => `Your verification code: ${props.otp}`,
)

// Use it
const program = sendOTPEmail(
  "user@example.com",
  {
    otp: "123456",
    username: "John Doe",
    expiryMinutes: 10,
  },
  {
    tags: [{ name: "category", value: "authentication" }],
  },
)
```

## Creating Custom Templates

### 1. Create a Template Component

```tsx
// src/templates/welcome-email.tsx
import React from "react"
import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components"
import { Tailwind } from "@react-email/tailwind"

export interface WelcomeEmailProps {
  username: string
  loginUrl: string
}

export function WelcomeEmail({ username, loginUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to our platform!</Preview>
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto my-10 max-w-[600px] rounded-lg bg-white p-8">
            <Heading className="text-2xl font-bold">Welcome, {username}!</Heading>
            <Text>We're excited to have you on board.</Text>
            <a href={loginUrl}>Get Started</a>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

export function welcomeEmailSubject(props: WelcomeEmailProps): string {
  return `Welcome ${props.username}!`
}
```

### 2. Use the Custom Template

```typescript
import { sendTemplate, makeEmailServiceLayer } from "@vimmer/email"
import { WelcomeEmail } from "./templates/welcome-email"

const program = sendTemplate({
  to: "user@example.com",
  subject: "Welcome!",
  template: WelcomeEmail({
    username: "John Doe",
    loginUrl: "https://example.com/login",
  }),
})
```

## Advanced Usage

### Composing with Other Services

```typescript
import { Effect, Layer } from "effect"
import { EmailService, makeEmailServiceLayer } from "@vimmer/email"
import { OTPEmail } from "@vimmer/email/templates/otp-email"

// Example: Compose with a user service
interface UserService {
  readonly getUser: (id: string) => Effect.Effect<User, UserError>
}

class UserService extends Context.Tag("UserService")<UserService, UserService>() {}

const sendUserOTP = (userId: string, otp: string) =>
  Effect.gen(function* () {
    const userService = yield* UserService
    const emailService = yield* EmailService

    const user = yield* userService.getUser(userId)

    const result = yield* emailService.send({
      to: user.email,
      subject: "Your verification code",
      template: OTPEmail({
        otp,
        username: user.name,
      }),
    })

    return result
  })

// Provide both services
const program = sendUserOTP("user-123", "123456")

const AppLayer = Layer.mergeAll(emailLayer, userServiceLayer)

await Effect.runPromise(program.pipe(Effect.provide(AppLayer)))
```

### Custom Configuration

```typescript
import { Layer } from "effect"
import { EmailService, EmailServiceConfig, EmailServiceLive } from "@vimmer/email"

// Create a custom configuration layer
const customConfigLayer = Layer.succeed(EmailServiceConfig, {
  apiKey: process.env.RESEND_API_KEY!,
  defaultFrom: "custom@example.com",
})

// Provide it to the service
const emailLayer = customConfigLayer.pipe(Layer.provide(EmailServiceLive))
```

## API Reference

### `EmailService`

The main service for sending emails.

#### Methods

- `send(params: SendEmailParams): Effect<SendEmailResult, EmailError>`
  - Send a single email
- `sendBatch(params: SendEmailParams[]): Effect<SendEmailResult[], EmailError>`
  - Send multiple emails in batch

### `SendEmailParams`

```typescript
interface SendEmailParams {
  readonly to: string | string[]
  readonly from?: string
  readonly subject: string
  readonly template: ReactElement
  readonly replyTo?: string
  readonly cc?: string | string[]
  readonly bcc?: string | string[]
  readonly tags?: Array<{ name: string; value: string }>
}
```

### `EmailServiceConfig`

```typescript
interface EmailServiceConfig {
  readonly apiKey: string
  readonly defaultFrom?: string
}
```

### Helper Functions

- `makeEmailServiceLayer(config: EmailServiceConfig): Layer<EmailService>`
  - Create a complete email service layer with configuration

- `sendTemplate(params: SendEmailParams): Effect<SendEmailResult, EmailError, EmailService>`
  - Send a single email (requires EmailService in context)

- `sendTemplateBatch(params: SendEmailParams[]): Effect<SendEmailResult[], EmailError, EmailService>`
  - Send multiple emails in batch (requires EmailService in context)

- `createTemplateSender<TProps>(templateFn, subjectFn)`
  - Create a reusable sender for a specific template

## Available Templates

- `OTPEmail` - One-time password/verification code email

## Error Handling

All email operations return `Effect<Result, EmailError>` where `EmailError` has the following shape:

```typescript
interface EmailError {
  readonly _tag: "EmailError"
  readonly message: string
  readonly cause?: unknown
}
```

Use Effect's error handling operators like `catchTag`, `catchAll`, or `retry` to handle errors.

## Testing

```typescript
import { Effect, Layer } from "effect"
import { EmailService } from "@vimmer/email"

// Create a test implementation
const TestEmailService = Layer.succeed(EmailService, {
  send: (params) =>
    Effect.succeed({
      id: "test-email-id",
    }),
  sendBatch: (params) => Effect.succeed(params.map((_, i) => ({ id: `test-email-id-${i}` }))),
})

// Use in tests
const program = sendTemplate({
  to: "test@example.com",
  subject: "Test",
  template: OTPEmail({ otp: "123456" }),
})

const result = await Effect.runPromise(program.pipe(Effect.provide(TestEmailService)))
```

## License

MIT
