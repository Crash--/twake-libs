import { exportJWK, generateKeyPair } from 'jose'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { discoverIdentityProvider, type IdentityProvider } from './provider.js'

const ISSUER = 'https://sso.test/'

interface FakeToken {
  introspection: Record<string, unknown>
  userinfo: Record<string, unknown> | null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

// Like LemonLDAP before 2.23, which does not URL-decode the credentials.
function basicCredentials(header: string | null): string {
  return atob(header?.replace(/^Basic /, '') ?? '')
}

interface FakeSso {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  failIntrospection: () => void
}

function fakeSso(jwks: unknown, tokens: Map<string, FakeToken>): FakeSso {
  let introspectionStatus = 200
  const fetch = (url: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers)
    switch (url) {
      case `${ISSUER}.well-known/openid-configuration`:
        return Promise.resolve(
          json({
            issuer: ISSUER,
            authorization_endpoint: `${ISSUER}oauth2/authorize`,
            token_endpoint: `${ISSUER}oauth2/token`,
            introspection_endpoint: `${ISSUER}oauth2/introspect`,
            userinfo_endpoint: `${ISSUER}oauth2/userinfo`,
            jwks_uri: `${ISSUER}oauth2/jwks`
          })
        )
      case `${ISSUER}oauth2/jwks`:
        return Promise.resolve(json(jwks))
      case `${ISSUER}oauth2/introspect`: {
        const credentials = basicCredentials(headers.get('authorization'))
        if (credentials !== 'twake-tasks-backend:secret') {
          return Promise.resolve(json({ error: 'invalid_client' }, 401))
        }
        if (introspectionStatus !== 200) {
          return Promise.resolve(json({}, introspectionStatus))
        }
        const token =
          init.body instanceof URLSearchParams ? init.body.get('token') : null
        const found = tokens.get(token ?? '')
        return Promise.resolve(json(found?.introspection ?? { active: false }))
      }
      case `${ISSUER}oauth2/userinfo`: {
        const token = headers.get('authorization')?.replace(/^Bearer /, '')
        const found = tokens.get(token ?? '')
        return Promise.resolve(
          found?.userinfo
            ? json(found.userinfo)
            : new Response(null, {
                status: 401,
                headers: { 'www-authenticate': 'Bearer error="invalid_token"' }
              })
        )
      }
      default:
        return Promise.resolve(new Response(null, { status: 404 }))
    }
  }
  return {
    fetch,
    failIntrospection: (): void => {
      introspectionStatus = 500
    }
  }
}

const now = (): number => Math.floor(Date.now() / 1000)

function validToken(): FakeToken {
  return {
    introspection: {
      active: true,
      sub: 'alice@example.com',
      exp: now() + 300,
      aud: ['twake-tasks']
    },
    userinfo: {
      sub: 'alice@example.com',
      sid: 'session-1',
      uuid: '0b7f6a1e-3c2d-4e5f-8a9b-1c2d3e4f5a6b',
      email: 'alice@example.com',
      org_id: 'org-1',
      org_role: 'member'
    }
  }
}

let publicJwk: Record<string, unknown>

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' }
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function setUp(
  tokens: Record<string, FakeToken> = {}
): Promise<{ provider: IdentityProvider; sso: FakeSso }> {
  const sso = fakeSso({ keys: [publicJwk] }, new Map(Object.entries(tokens)))
  vi.stubGlobal('fetch', sso.fetch)
  const provider = await discoverIdentityProvider({
    issuer: new URL(ISSUER),
    clientId: 'twake-tasks-backend',
    clientSecret: 'secret',
    audience: 'twake-tasks'
  })
  return { provider, sso }
}

describe('identify', () => {
  it('returns the identity of an active token', async () => {
    const { provider } = await setUp({ good: validToken() })

    const identity = await provider.identify('good')

    expect(identity).toMatchObject({
      subject: 'alice@example.com',
      userId: '0b7f6a1e-3c2d-4e5f-8a9b-1c2d3e4f5a6b',
      email: 'alice@example.com',
      sessionId: 'session-1',
      organizationId: 'org-1',
      organizationRole: 'member'
    })
  })

  it.each([
    ['inactive', { active: false }],
    ['expired', { exp: now() - 1 }],
    ['without aud', { aud: undefined }],
    ['for another audience', { aud: 'tmail' }],
    ['for another subject', { sub: 'bob@example.com' }]
  ])('refuses a token %s', async (_case, override) => {
    const token = validToken()
    token.introspection = { ...token.introspection, ...override }
    const { provider } = await setUp({ token })

    await expect(provider.identify('token')).resolves.toBeNull()
  })

  it.each([
    ['no email', { email: undefined }],
    ['no sid', { sid: undefined }],
    ['no uuid', { uuid: undefined }],
    ['a uuid that is not one', { uuid: 'alice' }]
  ])('refuses a token whose userinfo has %s', async (_case, override) => {
    const token = validToken()
    token.userinfo = { ...token.userinfo, ...override }
    const { provider } = await setUp({ token })

    await expect(provider.identify('token')).resolves.toBeNull()
  })

  it('refuses a token whose session ends between introspection and userinfo', async () => {
    const token = { ...validToken(), userinfo: null }
    const { provider } = await setUp({ token })

    await expect(provider.identify('token')).resolves.toBeNull()
  })

  it.each([
    [
      'given and family names',
      { name: 'qvalmori', given_name: 'Quentin', family_name: 'VALMORI' },
      'Quentin VALMORI'
    ],
    ['only a name', { name: 'Alice Martin' }, 'Alice Martin'],
    ['blank names', { name: ' ', given_name: '' }, null],
    ['no name', {}, null]
  ])('names the person from %s', async (_case, claims, name) => {
    const token = validToken()
    token.userinfo = { ...token.userinfo, ...claims }
    const { provider } = await setUp({ token })

    expect((await provider.identify('token'))?.name).toBe(name)
  })

  it('lets a B2C user, who has no organization, through', async () => {
    const token = validToken()
    token.userinfo = { ...token.userinfo, org_id: null, org_role: undefined }
    const { provider } = await setUp({ token })

    await expect(provider.identify('token')).resolves.toMatchObject({
      organizationId: null,
      organizationRole: null
    })
  })

  it('drops an organization role it does not know', async () => {
    const token = validToken()
    token.userinfo = { ...token.userinfo, org_role: 'superuser' }
    const { provider } = await setUp({ token })

    const identity = await provider.identify('token')

    expect(identity?.organizationRole).toBeNull()
  })

  it('refuses an unknown token', async () => {
    const { provider } = await setUp()

    await expect(provider.identify('unknown')).resolves.toBeNull()
  })

  it('fails when introspection fails', async () => {
    const { provider, sso } = await setUp({ good: validToken() })
    sso.failIntrospection()

    await expect(provider.identify('good')).rejects.toThrow()
  })
})
