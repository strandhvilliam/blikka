# @blikka/aws

Consolidated AWS wrapper package for Blikka.

It contains:

- S3 utilities and Effect client/service wrappers
- EventBridge bus utilities and schema helpers
- SNS/SMS Effect client/service wrappers

## Usage

```ts
import { S3Service, BusService, SMSService } from "@blikka/aws"
```

Subpath exports are also available:

- `@blikka/aws/s3`
- `@blikka/aws/bus`
- `@blikka/aws/sms`
