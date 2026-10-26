import { inspect } from 'node:util'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { discoverServiceToken, type ServiceToken } from './serviceToken.js'

const ISSUER = 'https://sso.test/'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

interface TokenRequest {
  authorization: string | null
  body: URLSearchParams
}

// Answers each token request with the next answer, the last one repeating.
function fakeSso(answers: Record<string, unknown>[]): TokenRequest[] {
  const requests: TokenRequest[] = []
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    switch (url) {
      case `${ISSUER}.well-known/openid-configuration`:
        return Promise.resolve(
          json({ issuer: ISSUER, token_endpoint: `${ISSUER}oauth2/token` })
        )
      case `${ISSUER}oauth2/token`: {
        requests.push({
          authorization: new Headers(init.headers).get('authorization'),
          body: new URLSearchParams(init.body as URLSearchParams)
        })
        const answer = answers[Math.min(requests.length, answers.length) - 1]
        return Promise.resolve(json(answer))
      }
      default:
        return Promise.resolve(new Response(null, { status: 404 }))
    }
  })
  return requests
}

function setUp(scope?: string): Promise<ServiceToken> {
  return discoverServiceToken({
    issuer: new URL(ISSUER),
    clientId: 'twake-chat-side-service',
    clientSecret: 'secret',
    scope
  })
}

const answer = (
  accessToken: string,
  expiresIn = 300
): Record<string, unknown> => ({
  access_token: accessToken,
  token_type: 'Bearer',
  expires_in: expiresIn
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('getToken', () => {
  it('asks for a client credentials token with a raw Basic header', async () => {
    const requests = fakeSso([answer('t1')])
    const serviceToken = await setUp('openid')

    await expect(serviceToken.getToken()).resolves.toBe('t1')

    // Like LemonLDAP before 2.23, which does not URL-decode the credentials.
    expect(requests[0].authorization).toBe(
      `Basic ${btoa('twake-chat-side-service:secret')}`
    )
    expect(requests[0].body.get('grant_type')).toBe('client_credentials')
    expect(requests[0].body.get('scope')).toBe('openid')
  })

  it('sends no scope when none is given', async () => {
    const requests = fakeSso([answer('t1')])
    const serviceToken = await setUp()

    await serviceToken.getToken()

    expect(requests[0].body.has('scope')).toBe(false)
  })

  it('keeps the token until shortly before it expires', async () => {
    const requests = fakeSso([answer('t1', 300), answer('t2')])
    const serviceToken = await setUp()

    await serviceToken.getToken()
    vi.advanceTimersByTime(269_000)
    await expect(serviceToken.getToken()).resolves.toBe('t1')
    vi.advanceTimersByTime(1_000)
    await expect(serviceToken.getToken()).resolves.toBe('t2')
    expect(requests).toHaveLength(2)
  })

  it('keeps a short-lived token for half its life', async () => {
    fakeSso([answer('t1', 20), answer('t2')])
    const serviceToken = await setUp()

    await serviceToken.getToken()
    vi.advanceTimersByTime(9_000)
    await expect(serviceToken.getToken()).resolves.toBe('t1')
    vi.advanceTimersByTime(1_000)
    await expect(serviceToken.getToken()).resolves.toBe('t2')
  })

  it('keeps a token without expires_in for 30 seconds', async () => {
    fakeSso([{ access_token: 't1', token_type: 'Bearer' }, answer('t2')])
    const serviceToken = await setUp()

    await serviceToken.getToken()
    vi.advanceTimersByTime(29_000)
    await expect(serviceToken.getToken()).resolves.toBe('t1')
    vi.advanceTimersByTime(1_000)
    await expect(serviceToken.getToken()).resolves.toBe('t2')
  })

  it('sends one request for callers asking at once', async () => {
    const requests = fakeSso([answer('t1')])
    const serviceToken = await setUp()

    const tokens = await Promise.all([
      serviceToken.getToken(),
      serviceToken.getToken(),
      serviceToken.getToken()
    ])

    expect(tokens).toEqual(['t1', 't1', 't1'])
    expect(requests).toHaveLength(1)
  })

  it('fails when the token endpoint answers no access_token', async () => {
    fakeSso([{ token_type: 'Bearer' }, answer('t2')])
    const serviceToken = await setUp()

    await expect(serviceToken.getToken()).rejects.toThrow(
      /^https:\/\/sso.test\/ answered an invalid token: .*access_token/
    )
    await expect(serviceToken.getToken()).resolves.toBe('t2')
  })

  it('keeps the token out of the error of an invalid answer', async () => {
    fakeSso([{ access_token: 'secret-token' }])
    const serviceToken = await setUp()

    const error = await serviceToken.getToken().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect(inspect(error, { depth: null })).not.toContain('secret-token')
  })
})

describe('forget', () => {
  it('drops the token it is given, so the next call asks for a new one', async () => {
    const requests = fakeSso([answer('t1'), answer('t2')])
    const serviceToken = await setUp()

    serviceToken.forget(await serviceToken.getToken())

    await expect(serviceToken.getToken()).resolves.toBe('t2')
    expect(requests).toHaveLength(2)
  })

  it('keeps a token that replaced the one it is given', async () => {
    const requests = fakeSso([answer('t1'), answer('t2')])
    const serviceToken = await setUp()
    serviceToken.forget(await serviceToken.getToken())
    await serviceToken.getToken()

    serviceToken.forget('t1')

    await expect(serviceToken.getToken()).resolves.toBe('t2')
    expect(requests).toHaveLength(2)
  })
})
