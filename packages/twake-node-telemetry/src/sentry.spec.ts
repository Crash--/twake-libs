import * as Sentry from '@sentry/node'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLogger } from './index'
import { initSentry } from './sentry'

describe('initSentry', () => {
  afterEach(async () => {
    vi.unstubAllEnvs()
    await Sentry.close()
  })

  it('sends nothing without SENTRY_DSN', () => {
    vi.stubEnv('SENTRY_DSN', '')

    const client = initSentry({ service: 'test-service', version: '1.2.3' })

    expect(Sentry.isEnabled()).toBe(false)
    expect(client?.getTransport()).toBeUndefined()
  })

  it('names the release and tags the service', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.example.com/1')
    vi.stubEnv('SENTRY_ENVIRONMENT', 'staging')

    const client = initSentry({ service: 'test-service', version: '1.2.3' })

    expect(client?.getOptions()).toMatchObject({
      dsn: 'https://key@sentry.example.com/1',
      environment: 'staging',
      release: 'test-service@1.2.3'
    })
    expect(Sentry.getCurrentScope().getScopeData().tags).toEqual({
      service: 'test-service'
    })
  })

  it('keeps users, cookies, headers, bodies, query strings, SQL parameters and AI prompts out', () => {
    vi.stubEnv('SENTRY_DSN', 'https://key@sentry.example.com/1')

    const client = initSentry({ service: 'test-service', version: '1.2.3' })

    expect(client?.getOptions().dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      genAI: { inputs: false, outputs: false }
    })
  })

  it('sends the error lines as events, and no other line', async () => {
    // Nothing listens on port 9: the envelopes are read before they are sent.
    vi.stubEnv('SENTRY_DSN', 'http://key@127.0.0.1:9/1')
    const client = initSentry({ service: 'test-service', version: '1.2.3' })
    const itemTypes: string[] = []
    const events: Sentry.Event[] = []
    client?.on('beforeEnvelope', ([, items]) => {
      for (const [header, payload] of items) {
        itemTypes.push(header.type)
        if (header.type === 'event') events.push(payload as Sentry.Event)
      }
    })
    const logger = createLogger(
      { service: 'test-service' },
      { write: () => undefined }
    )

    logger.info('hello')
    logger.warn('careful')
    logger.error(
      { err: new Error('boom'), user: { email: 'alice@example.com' } },
      'failed'
    )
    await client?.flush(2000)

    expect(itemTypes).not.toContain('log')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      level: 'error',
      release: 'test-service@1.2.3',
      tags: { service: 'test-service' },
      contexts: { pino: { user: { email: '[Redacted]' } } }
    })
  })
})
