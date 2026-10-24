import Fastify, {
  type FastifyInstance,
  type LightMyRequestResponse
} from 'fastify'
import { describe, expect, it, vi, type Mock } from 'vitest'

import { TooManyNewTokensError, type Authenticate } from './authenticator.js'
import { identityOf, registerOidc } from './fastify.js'
import type { IdentityProvider } from './provider.js'
import type { AuthStore } from './store.js'
import { anIdentity } from './testing.js'

async function setUp(
  authenticate: Authenticate = () => Promise.resolve(anIdentity())
): Promise<{ app: FastifyInstance; store: AuthStore & { revoke: Mock } }> {
  const app = Fastify()
  const provider: IdentityProvider = {
    identify: vi.fn(),
    verifyLogoutToken: vi.fn((token: string) =>
      token === 'valid'
        ? Promise.resolve('session-1')
        : Promise.reject(new Error('invalid'))
    )
  }
  const store = {
    isRevoked: vi.fn(),
    revoke: vi.fn(() => Promise.resolve())
  } satisfies AuthStore
  const requireIdentity = registerOidc(app, { authenticate, provider, store })
  app.get('/whoami', { preHandler: requireIdentity }, request => ({
    email: identityOf(request).email,
    organizationId: identityOf(request).organizationId
  }))
  app.post('/echo', request => request.body)
  await app.ready()
  return { app, store }
}

function logout(
  app: FastifyInstance,
  payload: string,
  url = '/auth/backchannel-logout'
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: 'POST',
    url,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload
  })
}

describe('requireIdentity', () => {
  it('asks for a bearer token', async () => {
    const { app } = await setUp()

    const response = await app.inject({ method: 'GET', url: '/whoami' })

    expect(response.statusCode).toBe(401)
    expect(response.headers['www-authenticate']).toBe('Bearer')
  })

  it('refuses an invalid token', async () => {
    const { app } = await setUp(() => Promise.resolve(null))

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: 'Bearer nope' }
    })

    expect(response.statusCode).toBe(401)
    expect(response.headers['www-authenticate']).toBe(
      'Bearer error="invalid_token"'
    )
  })

  it.each([
    ['the SSO is down', new Error('sso down')],
    ['too many new tokens wait', new TooManyNewTokensError()]
  ])('answers 503 when %s', async (_case, error) => {
    const { app } = await setUp(() => Promise.reject(error))

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: 'Bearer token' }
    })

    expect(response.statusCode).toBe(503)
  })

  it.each([
    ['a B2B user', 'org-1'],
    ['a B2C user, who has no organization', null]
  ])('lets %s through', async (_case, organizationId) => {
    const { app } = await setUp(() =>
      Promise.resolve(anIdentity({ organizationId }))
    )

    const response = await app.inject({
      method: 'GET',
      url: '/whoami',
      headers: { authorization: 'bearer token' }
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      email: 'alice@example.com',
      organizationId
    })
  })
})

describe('back-channel logout', () => {
  it('revokes the session of a valid logout token', async () => {
    const { app, store } = await setUp()

    const response = await logout(app, 'logout_token=valid')

    expect(response.statusCode).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(store.revoke).toHaveBeenCalledWith('session-1', expect.any(Date))
  })

  it.each([['logout_token=forged'], ['']])('refuses %j', async payload => {
    const { app, store } = await setUp()

    const response = await logout(app, payload)

    expect(response.statusCode).toBe(400)
    expect(store.revoke).not.toHaveBeenCalled()
  })

  it('leaves form bodies on the other routes to the service', async () => {
    const { app } = await setUp()

    const response = await logout(app, 'a=1', '/echo')

    expect(response.statusCode).toBe(415)
  })
})
