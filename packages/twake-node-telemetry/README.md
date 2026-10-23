# twake-node-telemetry

Logs and Sentry for Twake Node backends: every service writes the same log format and masks the same secrets.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-node-telemetry pino
```

## Logs

```ts
import { createLogger } from '@linagora/twake-node-telemetry'

export const logger = createLogger({ service: 'meet-side-service' })
```

The level comes from `level`, then `LOG_LEVEL`, then `info`. Each line is JSON:

```json
{"level":"info","time":"2026-10-23T08:40:05.937Z","service":"meet-side-service","msg":"started"}
```

The values of `authorization` (or `Authorization`), `cookie`, `access_token`, `openid_token`, `password` and `email` become `[Redacted]`, up to four levels deep (`err.config.headers.Authorization`). To follow a user across lines without logging the address, log `hashEmail(email)`.
