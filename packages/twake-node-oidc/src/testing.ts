import type { Identity } from './provider.js'

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
