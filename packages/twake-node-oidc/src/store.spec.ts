import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { beforeEach, describe, expect, it } from 'vitest'

import { drizzleAuthStore, oidcRevokedSessions } from './drizzle.js'
import { memoryAuthStore, type AuthStore } from './store.js'

const HOUR = 60 * 60 * 1000

async function postgresStore(): Promise<{
  store: AuthStore
  count: () => Promise<number>
}> {
  const client = new PGlite()
  await client.exec(`
    create table oidc_revoked_sessions (
      sid text primary key,
      revoked_at timestamp with time zone default now() not null,
      expires_at timestamp with time zone not null
    )
  `)
  const db = drizzle({ client })
  return {
    store: drizzleAuthStore(db),
    count: async () => (await db.select().from(oidcRevokedSessions)).length
  }
}

describe.each([
  [
    'memoryAuthStore',
    (): Promise<{ store: AuthStore }> =>
      Promise.resolve({ store: memoryAuthStore() })
  ],
  ['drizzleAuthStore', postgresStore]
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

describe('drizzleAuthStore', () => {
  it('drops ended revocations on the next logout', async () => {
    const { store, count } = await postgresStore()
    await store.revoke('old', new Date(Date.now() - 1))

    await store.revoke('new', new Date(Date.now() + HOUR))

    expect(await count()).toBe(1)
  })
})
