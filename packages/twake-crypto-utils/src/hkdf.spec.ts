import { describe, expect, it } from 'vitest'

import { hkdfExpand } from './hkdf.js'
import { hexDecode, hexEncode } from './internal/encoding.js'

describe('hkdfExpand', () => {
  it('matches RFC 5869 Test Case 1 (SHA-256, L=42)', async () => {
    // RFC's PRK below is the *output* of HKDF-Extract for Test Case 1;
    // hkdfExpand consumes that PRK directly.
    const prk = hexDecode(
      '077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5'
    )
    const info = hexDecode('f0f1f2f3f4f5f6f7f8f9')
    const okm = await hkdfExpand(prk, info, 42)

    expect(hexEncode(new Uint8Array(okm))).toBe(
      '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865'
    )
  })

  it('produces deterministic output for the same inputs', async () => {
    const prk = new Uint8Array(32).fill(7)
    const info = new TextEncoder().encode('ctx')
    const a = await hkdfExpand(prk, info, 64)
    const b = await hkdfExpand(prk, info, 64)
    expect(hexEncode(new Uint8Array(a))).toBe(hexEncode(new Uint8Array(b)))
  })

  it('differs across info contexts', async () => {
    const prk = new Uint8Array(32).fill(7)
    const a = await hkdfExpand(prk, new TextEncoder().encode('enc'), 32)
    const b = await hkdfExpand(prk, new TextEncoder().encode('mac'), 32)
    expect(hexEncode(new Uint8Array(a))).not.toBe(hexEncode(new Uint8Array(b)))
  })

  it('rejects requests beyond 255 * HashLen', async () => {
    const prk = new Uint8Array(32)
    const info = new Uint8Array(0)
    await expect(hkdfExpand(prk, info, 255 * 32 + 1)).rejects.toThrow(
      'exceeds 255'
    )
  })

  it('accepts an ArrayBuffer as prk input', async () => {
    const prkBytes = new Uint8Array(32).fill(11)
    const fromUint8 = await hkdfExpand(
      prkBytes,
      new TextEncoder().encode('ctx'),
      32
    )
    const fromArrayBuffer = await hkdfExpand(
      prkBytes.buffer,
      new TextEncoder().encode('ctx'),
      32
    )
    expect(hexEncode(new Uint8Array(fromUint8))).toBe(
      hexEncode(new Uint8Array(fromArrayBuffer))
    )
  })

  it('accepts empty info', async () => {
    const prk = new Uint8Array(32).fill(7)
    const okm = await hkdfExpand(prk, new Uint8Array(0), 32)
    expect(okm.byteLength).toBe(32)
  })

  it('produces a non-zero output for length=1 (smallest non-trivial)', async () => {
    const prk = new Uint8Array(32).fill(7)
    const okm = await hkdfExpand(prk, new TextEncoder().encode('x'), 1)
    expect(okm.byteLength).toBe(1)
  })

  it('produces exactly the requested length when length is not a multiple of 32', async () => {
    const prk = new Uint8Array(32).fill(7)
    const okm = await hkdfExpand(prk, new TextEncoder().encode('x'), 50)
    expect(okm.byteLength).toBe(50)
  })

  it('produces the maximum 255 * HashLen bytes', async () => {
    const prk = new Uint8Array(32)
    const okm = await hkdfExpand(prk, new Uint8Array(0), 255 * 32)
    expect(okm.byteLength).toBe(255 * 32)
  })
})
