# twake-node-telemetry

Logs and Sentry for Twake Node backends: every service writes the same log format and masks the same secrets.

## Requirements

You need to use Node 24+

## Installation

```bash
npm install @linagora/twake-node-telemetry pino @sentry/node
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

Give Fastify the logger and `genReqId`: each request log carries a `reqId`, the `X-Request-Id` of the caller when it is a short id of safe characters, a new UUID otherwise.

```ts
import Fastify from 'fastify'
import { genReqId } from '@linagora/twake-node-telemetry'

const app = Fastify({ loggerInstance: logger, genReqId })
```

## Sentry

Start Sentry from its own file, loaded with `node --import ./dist/instrument.js dist/main.js`, so Sentry can instrument the modules `main.ts` loads (http, Fastify, postgres). Its entry point does not load pino or anything else.

```ts
// src/instrument.ts
import { readFileSync } from 'node:fs'
import { initSentry } from '@linagora/twake-node-telemetry/sentry'

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
) as { version: string }

initSentry({ service: 'meet-side-service', version })
```

Sentry reads `SENTRY_DSN` and `SENTRY_ENVIRONMENT`, and sends nothing without a DSN. Events carry the release `<service>@<version>` and a `service` tag. Logs at `error` and `fatal` become Sentry errors, the other lines stay out of Sentry, and an unhandled promise rejection stops the process, as Node does without Sentry.
