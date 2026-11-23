import { describe, expect, it } from 'vitest'

import { hmacSha256, verifyHmacSha256 } from './hmac.js'

describe('verifyHmacSha256', () => {
  it('returns true for a matching digest', async () => {
    const digest = await hmacSha256('payload', 'secret')
    expect(await verifyHmacSha256('payload', 'secret', digest)).toBe(true)
  })

  it('returns false for a non-matching digest of the same length', async () => {
    const digest = await hmacSha256('payload', 'secret')
    const tampered = digest.slice(0, -1) + (digest.endsWith('a') ? 'b' : 'a')
    expect(await verifyHmacSha256('payload', 'secret', tampered)).toBe(false)
  })

  it('returns false for a digest of the wrong length', async () => {
    expect(await verifyHmacSha256('payload', 'secret', 'short')).toBe(false)
    expect(await verifyHmacSha256('payload', 'secret', 'a'.repeat(63))).toBe(
      false
    )
    expect(await verifyHmacSha256('payload', 'secret', 'a'.repeat(65))).toBe(
      false
    )
  })

  it('returns false on the wrong secret', async () => {
    const digest = await hmacSha256('payload', 'secret1')
    expect(await verifyHmacSha256('payload', 'secret2', digest)).toBe(false)
  })

  it('returns false on the wrong input', async () => {
    const digest = await hmacSha256('payload-a', 'secret')
    expect(await verifyHmacSha256('payload-b', 'secret', digest)).toBe(false)
  })

  it('returns false on empty expected', async () => {
    expect(await verifyHmacSha256('payload', 'secret', '')).toBe(false)
  })
})
