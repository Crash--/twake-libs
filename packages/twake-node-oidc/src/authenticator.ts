import { createHash } from 'node:crypto'

import type { Identity, IdentityProvider } from './provider.js'
import type { AuthStore } from './store.js'

// Resolves to null for a token the provider refuses or whose session is
// revoked; rejects when the provider cannot be asked, or with
// TooManyNewTokensError when too many unknown tokens wait for a check.
export type Authenticate = (accessToken: string) => Promise<Identity | null>

export interface AuthenticatorOptions {
  provider: IdentityProvider
  store: AuthStore
  // Checks of tokens never seen before running at once, and waiting in line.
  newTokenChecks?: number
  newTokensWaiting?: number
  now?: () => number
}

const CACHE_TTL_MS = 60_000
const MAX_REFUSED = 10_000

export class TooManyNewTokensError extends Error {
  constructor() {
    super('too many new tokens waiting for a check')
    this.name = 'TooManyNewTokensError'
  }
}

// Runs at most `running` tasks at once with `waiting` more in line, and
// refuses the rest at once.
export function gate(running: number, waiting: number) {
  let busy = 0
  const line: (() => void)[] = []
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (busy < running) busy++
    else if (line.length < waiting) {
      await new Promise<void>(resolve => line.push(resolve))
    } else throw new TooManyNewTokensError()
    try {
      return await task()
    } finally {
      const next = line.shift()
      if (next) next()
      else busy--
    }
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}

export function createAuthenticator(
  options: AuthenticatorOptions
): Authenticate {
  const now = options.now ?? Date.now
  // An entry outlives its 60 seconds until the token expires, so a token
  // checked before is told apart from one never seen.
  const cache = new Map<string, { identity: Identity; until: number }>()
  // Anyone can send made-up tokens, each one a call to the provider. Tokens
  // seen before skip the line; a refreshed token is a new one and waits.
  const newToken = gate(
    options.newTokenChecks ?? 10,
    options.newTokensWaiting ?? 100
  )
  const checking = new Map<string, Promise<Identity | null>>()

  // Entries are not in expiry order (tokens differ in lifetime), so this scans
  // them all, at most once a minute.
  let nextSweep = 0
  function evictExpired(at: number): void {
    if (at < nextSweep) return
    nextSweep = at + CACHE_TTL_MS
    for (const [key, entry] of cache) {
      if (entry.identity.expiresAt.getTime() <= at) cache.delete(key)
    }
  }

  // Spares the provider a refused token sent again; bounded, since anyone can
  // send new ones.
  const refused = new Map<string, number>()
  function refuse(key: string, at: number): void {
    const [oldest] = refused.keys()
    if (oldest !== undefined && refused.size >= MAX_REFUSED) {
      refused.delete(oldest)
    }
    refused.set(key, at + CACHE_TTL_MS)
  }

  return async accessToken => {
    const key = sha256(accessToken)
    const at = now()
    const refusedUntil = refused.get(key)
    if (refusedUntil !== undefined) {
      if (refusedUntil > at) return null
      refused.delete(key)
    }
    let entry = cache.get(key)
    if (!entry || entry.until <= at) {
      const seen =
        entry !== undefined && entry.identity.expiresAt.getTime() > at
      // The requests a page sends at once share one check and one place in line.
      let check = checking.get(key)
      if (!check) {
        const identify = (): Promise<Identity | null> =>
          options.provider.identify(accessToken)
        check = (seen ? identify() : newToken(identify)).finally(() =>
          checking.delete(key)
        )
        checking.set(key, check)
      }
      const identity = await check
      // Kept until the provider answers, so a request alongside this one, or
      // after a provider failure, still counts the token as seen.
      cache.delete(key)
      if (!identity) {
        refuse(key, at)
        return null
      }
      evictExpired(at)
      entry = {
        identity,
        until: Math.min(identity.expiresAt.getTime(), at + CACHE_TTL_MS)
      }
      cache.set(key, entry)
    }
    if (await options.store.isRevoked(entry.identity.sessionId)) return null
    return entry.identity
  }
}
