import { describe, expect, it } from 'vitest'

import { pbkdf2Hash } from './pbkdf2.js'

describe('pbkdf2Hash', () => {
  it('produces a base64 hash and a 32-byte master key', async () => {
    const result = await pbkdf2Hash(
      'correct horse battery staple',
      'salt@example.com',
      1000
    )
    expect(result).not.toBeNull()
    expect(result!.hashed).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(result!.masterKey.byteLength).toBe(32)
  })

  it('is deterministic for the same inputs', async () => {
    const a = await pbkdf2Hash('pw', 'salt', 1000)
    const b = await pbkdf2Hash('pw', 'salt', 1000)
    expect(a!.hashed).toBe(b!.hashed)
  })

  it('produces different output for different passwords', async () => {
    const a = await pbkdf2Hash('pw1', 'salt', 1000)
    const b = await pbkdf2Hash('pw2', 'salt', 1000)
    expect(a!.hashed).not.toBe(b!.hashed)
  })

  it('produces different output for different salts', async () => {
    const a = await pbkdf2Hash('pw', 'salt1', 1000)
    const b = await pbkdf2Hash('pw', 'salt2', 1000)
    expect(a!.hashed).not.toBe(b!.hashed)
  })
})
