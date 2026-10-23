import * as Sentry from '@sentry/node'

// Call it from a file loaded with node --import, so Sentry can instrument the
// modules main.ts loads (http, Fastify, postgres). Sentry reads SENTRY_DSN and
// SENTRY_ENVIRONMENT itself, and sends nothing without a DSN.
export function initSentry(options: {
  service: string
  version: string
}): Sentry.NodeClient | undefined {
  return Sentry.init({
    release: `${options.service}@${options.version}`,
    initialScope: { tags: { service: options.service } },
    integrations: [
      // The cluster already keeps the logs: Sentry only gets the errors.
      Sentry.pinoIntegration({
        log: { levels: [] },
        error: { levels: ['error', 'fatal'] }
      }),
      // Sentry's default only warns, where Node would stop the process.
      Sentry.onUnhandledRejectionIntegration({ mode: 'strict' })
    ]
  })
}
