import { createHash } from 'node:crypto'

import { pino, type DestinationStream, type Logger } from 'pino'

// pino matches keys case-sensitively: outgoing headers keep their capital.
const SECRET_KEYS = [
  'authorization',
  'Authorization',
  'cookie',
  'access_token',
  'openid_token',
  'password',
  'email'
]

// shortcut: secrets deeper than four levels stay visible, walk the whole object once a service logs such payloads.
const REDACTED_PATHS = SECRET_KEYS.flatMap(key => [
  key,
  `*.${key}`,
  `*.*.${key}`,
  `*.*.*.${key}`
])

export function createLogger(
  options: { service: string; level?: string },
  destination?: DestinationStream
): Logger {
  return pino(
    {
      level: options.level || process.env.LOG_LEVEL || 'info',
      base: { service: options.service },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: label => ({ level: label }) },
      redact: REDACTED_PATHS
    },
    destination
  )
}

export function hashEmail(email: string): string {
  return createHash('sha256')
    .update(email.toLowerCase())
    .digest('hex')
    .slice(0, 16)
}
