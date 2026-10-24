import { beforeEach, describe, expect, it } from 'vitest'

import { memoryAuthStore, type AuthStore } from './store.js'

const HOUR = 60 * 60 * 1000

describe.each([
  [
    'memoryAuthStore',
    (): Promise<{ store: AuthStore }> =>
      Promise.resolve({ store: memoryAuthStore() })
  ]
])('%s', (_name, create) => {
  let store: AuthStore

  beforeEach(async () => {
    ;({ store } = await create())
  })

  it('tells a revoked session from another', async () => {
    await store.revoke('session-1', new Date(Date.now() + HOUR))

    await expect(store.isRevoked('session-1')).resolves.toBe(true)
    await expect(store.isRevoked('session-2')).resolves.toBe(false)
  })

  it('accepts the same logout twice', async () => {
    const until = new Date(Date.now() + HOUR)
    await store.revoke('session-1', until)
    await store.revoke('session-1', until)

    await expect(store.isRevoked('session-1')).resolves.toBe(true)
  })

  it('keeps the later end when a session is logged out again', async () => {
    await store.revoke('session-1', new Date(Date.now() + HOUR))
    await store.revoke('session-1', new Date(Date.now() - 1))

    await expect(store.isRevoked('session-1')).resolves.toBe(true)
  })

  it('no longer counts a revocation past its end', async () => {
    await store.revoke('session-1', new Date(Date.now() - 1))

    await expect(store.isRevoked('session-1')).resolves.toBe(false)
  })
})
