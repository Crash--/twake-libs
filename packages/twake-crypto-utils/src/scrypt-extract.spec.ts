import { describe, expect, it } from 'vitest'

import { extractScryptParameters, generateScryptHash } from './scrypt.js'

describe('extractScryptParameters', () => {
  it('round-trips a base64-wrapped scrypt hash', () => {
    const salt = new Uint8Array(16).fill(3)
    const text = generateScryptHash('pw', salt, 1024, 8, 1, 32)
    const wrapped = Buffer.from(text).toString('base64')

    const parsed = extractScryptParameters(wrapped)
    expect(parsed.n).toBe(1024)
    expect(parsed.r).toBe(8)
    expect(parsed.p).toBe(1)
    expect(parsed.dkLen).toBe(32)
    expect(Array.from(parsed.salt)).toEqual(Array.from(salt))
  })

  it('throws on input that is not base64(scrypt$...)', () => {
    expect(() =>
      extractScryptParameters(Buffer.from('not-scrypt').toString('base64'))
    ).toThrow('Invalid hash format')
  })
})
