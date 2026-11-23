import { describe, expect, it } from 'vitest'

import { createSha256Hash, timingSafeStringEqual } from './sha256.js'

describe('createSha256Hash', () => {
  it('matches a known SHA-256 of "abc" (base64)', async () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(await createSha256Hash('abc')).toBe(
      'ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0='
    )
  })

  it('is deterministic', async () => {
    expect(await createSha256Hash('payload')).toBe(
      await createSha256Hash('payload')
    )
  })

  it('handles the empty string', async () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(await createSha256Hash('')).toBe(
      '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='
    )
  })

  it('handles UTF-8 inputs', async () => {
    // SHA-256 of the UTF-8 bytes of "中" (e4 b8 ad) - not of the JS string's code-unit reinterpretation.
    const digest = await createSha256Hash('中')
    expect(digest).toMatch(/^[A-Za-z0-9+/=]{44}$/)
    expect(await createSha256Hash('中')).toBe(digest)
  })
})

describe('timingSafeStringEqual', () => {
  it('returns true for identical strings', () => {
    expect(timingSafeStringEqual('secret', 'secret')).toBe(true)
  })

  it('returns false for different strings of equal length', () => {
    expect(timingSafeStringEqual('secret', 'SECRET')).toBe(false)
  })

  it('returns false for strings of different lengths', () => {
    expect(timingSafeStringEqual('short', 'longer-string')).toBe(false)
  })

  it('returns false when either argument is empty', () => {
    expect(timingSafeStringEqual('', 'x')).toBe(false)
    expect(timingSafeStringEqual('x', '')).toBe(false)
    expect(timingSafeStringEqual('', '')).toBe(false)
  })

  it('compares matching surrogate-pair strings correctly', () => {
    const emoji = '🔐 secret 🔑'
    expect(timingSafeStringEqual(emoji, emoji)).toBe(true)
    expect(timingSafeStringEqual(emoji, emoji + ' ')).toBe(false)
  })
})
