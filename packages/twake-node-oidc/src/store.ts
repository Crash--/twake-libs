export interface AuthStore {
  isRevoked: (sessionId: string) => Promise<boolean>
  // Kept at least until `until`, after which no token of the session is valid.
  revoke: (sessionId: string, until: Date) => Promise<void>
}

// Revocations held by one process: for tests and single-replica services.
export function memoryAuthStore(): AuthStore {
  const revoked = new Map<string, number>()
  return {
    isRevoked: (sessionId): Promise<boolean> => {
      const until = revoked.get(sessionId)
      if (until === undefined) return Promise.resolve(false)
      if (until > Date.now()) return Promise.resolve(true)
      revoked.delete(sessionId)
      return Promise.resolve(false)
    },
    revoke: (sessionId, until): Promise<void> => {
      revoked.set(
        sessionId,
        Math.max(revoked.get(sessionId) ?? 0, until.getTime())
      )
      return Promise.resolve()
    }
  }
}
