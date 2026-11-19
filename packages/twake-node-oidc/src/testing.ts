import type { Oidc } from './index.js'
import type { Identity } from './provider.js'
import { memoryAuthStore } from './store.js'

export function anIdentity(overrides: Partial<Identity> = {}): Identity {
  return {
    subject: 'alice@example.com',
    userId: '0b7f6a1e-3c2d-4e5f-8a9b-1c2d3e4f5a6b',
    email: 'alice@example.com',
    name: null,
    sessionId: 'session-1',
    expiresAt: new Date(Date.now() + 300_000),
    organizationId: 'org-1',
    organizationRole: 'member',
    ...overrides
  }
}

// Stands in for connectOidc in a service's route tests: each access token
// maps to an identity, or to null for one the SSO would refuse.
export function fakeOidc(
  identityOf: (accessToken: string) => Identity | null
): Oidc {
  const unused = (): Promise<never> =>
    Promise.reject(new Error('not used by fakeOidc'))
  return {
    provider: { identify: unused, verifyLogoutToken: unused },
    store: memoryAuthStore(),
    authenticate: accessToken => Promise.resolve(identityOf(accessToken))
  }
}
