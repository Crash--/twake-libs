import { randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  generateScryptHash,
  marshalScryptText,
  unmarshalScryptText
} from './scrypt.js'

describe('scrypt', () => {
  it('round-trips through marshal/unmarshal', () => {
    const salt = new Uint8Array(randomBytes(16))
    const dk = new Uint8Array(randomBytes(32))
    const text = marshalScryptText(16384, 8, 1, salt, dk)
    const parsed = unmarshalScryptText(text)

    expect(parsed.n).toBe(16384)
    expect(parsed.r).toBe(8)
    expect(parsed.p).toBe(1)
    expect(parsed.dkLen).toBe(32)
    expect(Array.from(parsed.salt)).toEqual(Array.from(salt))
    expect(Array.from(parsed.dk)).toEqual(Array.from(dk))
  })

  it('rejects a malformed scrypt string', () => {
    expect(() => unmarshalScryptText('bogus')).toThrow('Invalid hash format')
    expect(() => unmarshalScryptText('scrypt$x$8$1$ab$cd')).toThrow(
      'Invalid hash parameters'
    )
  })

  it('generates a hash that parses back to its inputs', () => {
    // Low N here: we're checking the serialization format, not the KDF strength.
    const salt = new Uint8Array(randomBytes(16))
    const text = generateScryptHash('hunter2', salt, 1024, 8, 1, 32)

    expect(text.startsWith('scrypt$1024$8$1$')).toBe(true)
    const parsed = unmarshalScryptText(text)
    expect(parsed.dk.length).toBe(32)
    expect(Array.from(parsed.salt)).toEqual(Array.from(salt))
  })

  it('produces deterministic output for the same inputs', () => {
    const salt = new Uint8Array(16).fill(7)
    const a = generateScryptHash('pw', salt, 1024, 8, 1, 32)
    const b = generateScryptHash('pw', salt, 1024, 8, 1, 32)
    expect(a).toBe(b)
  })

  it('throws on N that is not a power of two', () => {
    const salt = new Uint8Array(16)
    expect(() => generateScryptHash('pw', salt, 3, 8, 1, 32)).toThrow()
  })

  it('throws when N/r/p exceed the 64 MiB maxmem budget', () => {
    const salt = new Uint8Array(16)
    expect(() => generateScryptHash('pw', salt, 2 ** 21, 8, 1, 32)).toThrow()
  })

  it('marshals the same scrypt string for equal inputs', () => {
    const salt = new Uint8Array(8).fill(2)
    const dk = new Uint8Array(16).fill(9)
    expect(marshalScryptText(1024, 8, 1, salt, dk)).toBe(
      marshalScryptText(1024, 8, 1, salt, dk)
    )
  })
})
