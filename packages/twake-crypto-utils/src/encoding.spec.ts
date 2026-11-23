import { describe, expect, it } from 'vitest'

import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64UrlDecode,
  base64UrlEncode,
  hexDecode,
  hexEncode
} from './internal/encoding.js'

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255])
    const round = new Uint8Array(
      base64ToArrayBuffer(arrayBufferToBase64(bytes))
    )
    expect(Array.from(round)).toEqual(Array.from(bytes))
  })
})

describe('base64url helpers', () => {
  it('substitutes + and / and strips padding', () => {
    // bytes that produce + and / in standard base64
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe])
    const std = arrayBufferToBase64(bytes)
    expect(std).toContain('/')
    const url = base64UrlEncode(bytes)
    expect(url).not.toContain('+')
    expect(url).not.toContain('/')
    expect(url).not.toContain('=')
  })

  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 0xfb, 0xff, 0x3f, 0x40, 0x7f])
    const round = new Uint8Array(base64UrlDecode(base64UrlEncode(bytes)))
    expect(Array.from(round)).toEqual(Array.from(bytes))
  })

  it('accepts input with or without padding', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5])
    const url = base64UrlEncode(bytes)
    expect(Array.from(new Uint8Array(base64UrlDecode(url)))).toEqual(
      Array.from(bytes)
    )
    expect(Array.from(new Uint8Array(base64UrlDecode(url + '=')))).toEqual(
      Array.from(bytes)
    )
  })

  it('rejects strings whose length mod 4 is 1', () => {
    expect(() => base64UrlDecode('abcde')).toThrow()
  })

  it('round-trips at every length 0..16 (covers all padding cases)', () => {
    for (let len = 0; len <= 16; len++) {
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) bytes[i] = (i * 37 + 1) & 0xff
      const round = new Uint8Array(base64UrlDecode(base64UrlEncode(bytes)))
      expect(Array.from(round)).toEqual(Array.from(bytes))
    }
  })

  it('encodes an empty input to an empty string', () => {
    expect(base64UrlEncode(new Uint8Array(0))).toBe('')
    expect(base64UrlDecode('').byteLength).toBe(0)
  })
})

describe('hex helpers', () => {
  it('round-trips', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    expect(hexEncode(bytes)).toBe('deadbeef')
    expect(Array.from(hexDecode('deadbeef'))).toEqual(Array.from(bytes))
  })

  it('rejects odd-length and non-hex input', () => {
    expect(() => hexDecode('abc')).toThrow('odd length')
    expect(() => hexDecode('zz')).toThrow()
  })
})
