import { describe, expect, it } from 'vitest'

import { generateRandomString, generateRandomToken } from './random.js'

describe('generateRandomToken', () => {
  it('returns a hex string of the expected length', () => {
    expect(generateRandomToken(16)).toMatch(/^[0-9a-f]{32}$/)
    expect(generateRandomToken(32)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('defaults to 32 bytes (64 hex chars)', () => {
    expect(generateRandomToken()).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces different tokens on each call', () => {
    expect(generateRandomToken()).not.toBe(generateRandomToken())
  })
})

describe('generateRandomString', () => {
  it('returns a string of the requested length', () => {
    expect(generateRandomString(10).length).toBe(10)
    expect(generateRandomString(64).length).toBe(64)
  })

  it('defaults to the alphanumeric alphabet', () => {
    expect(generateRandomString(100)).toMatch(/^[A-Za-z0-9]{100}$/)
  })

  it('respects a custom alphabet', () => {
    expect(generateRandomString(50, 'AB')).toMatch(/^[AB]{50}$/)
  })

  it('rejects empty and oversized alphabets', () => {
    expect(() => generateRandomString(10, '')).toThrow()
    expect(() => generateRandomString(10, 'x'.repeat(257))).toThrow()
  })

  it('produces different strings on each call', () => {
    expect(generateRandomString(32)).not.toBe(generateRandomString(32))
  })
})
