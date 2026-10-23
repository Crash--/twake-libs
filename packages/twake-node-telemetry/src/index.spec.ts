import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createLogger, genReqId, hashEmail } from './index'

function logLine(
  log: (logger: ReturnType<typeof createLogger>) => void
): Record<string, unknown> {
  const lines: string[] = []
  const logger = createLogger(
    { service: 'test-service' },
    { write: line => lines.push(line) }
  )
  log(logger)
  return JSON.parse(lines[0]) as Record<string, unknown>
}

describe('createLogger', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('writes the service, the level as text and an ISO time', () => {
    const line = logLine(logger => logger.warn('hello'))

    expect(line).toMatchObject({
      service: 'test-service',
      level: 'warn',
      msg: 'hello'
    })
    expect(new Date(line.time as string).toISOString()).toBe(line.time)
    expect(line).not.toHaveProperty('pid')
    expect(line).not.toHaveProperty('hostname')
  })

  it('masks secrets up to four levels deep', () => {
    const line = logLine(logger =>
      logger.info(
        {
          password: 'hunter2',
          req: { headers: { authorization: 'Bearer abc', cookie: 'sid=1' } },
          body: {
            access_token: 'abc',
            openid_token: 'def',
            users: [{ email: 'bob@example.com' }]
          },
          user: { email: 'alice@example.com', name: 'Alice' }
        },
        'request'
      )
    )

    expect(line).toMatchObject({
      password: '[Redacted]',
      req: { headers: { authorization: '[Redacted]', cookie: '[Redacted]' } },
      body: {
        access_token: '[Redacted]',
        openid_token: '[Redacted]',
        users: [{ email: '[Redacted]' }]
      },
      user: { email: '[Redacted]', name: 'Alice' }
    })
  })

  it('masks the secrets an error carries', () => {
    const err = Object.assign(new Error('boom'), {
      config: { headers: { Authorization: 'Bearer abc' } }
    })

    const line = logLine(logger => logger.error({ err }, 'call failed'))

    expect(line).toMatchObject({
      err: {
        message: 'boom',
        config: { headers: { Authorization: '[Redacted]' } }
      }
    })
  })

  it('takes the level option, then LOG_LEVEL, then info', () => {
    vi.stubEnv('LOG_LEVEL', 'debug')
    expect(createLogger({ service: 's', level: 'warn' }).level).toBe('warn')
    expect(createLogger({ service: 's' }).level).toBe('debug')
    vi.stubEnv('LOG_LEVEL', '')
    expect(createLogger({ service: 's' }).level).toBe('info')
  })
})

describe('genReqId', () => {
  const requestWith = (headers: IncomingHttpHeaders): IncomingMessage =>
    ({ headers }) as IncomingMessage

  it('keeps the X-Request-Id of the caller', () => {
    expect(genReqId(requestWith({ 'x-request-id': 'abc-123' }))).toBe('abc-123')
  })

  it.each([
    ['no header', {}],
    ['a line break', { 'x-request-id': 'abc\ninjected' }],
    ['a long header', { 'x-request-id': 'a'.repeat(129) }]
  ])('makes a new id when the request has %s', (_, headers) => {
    expect(genReqId(requestWith(headers))).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('hashEmail', () => {
  it('gives the same short hash whatever the case', () => {
    expect(hashEmail('Alice@Example.com')).toBe(hashEmail('alice@example.com'))
    expect(hashEmail('alice@example.com')).toMatch(/^[0-9a-f]{16}$/)
  })
})
