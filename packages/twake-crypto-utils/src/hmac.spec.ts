import { describe, expect, it } from 'vitest'

import { hmacSha256 } from './hmac.js'
import { hexDecode } from './internal/encoding.js'

const bytesToBinaryString = (bytes: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}

describe('hmacSha256', () => {
  it('matches a known RFC 4231 test vector', async () => {
    // Test case 1 from RFC 4231: key = 20 bytes of 0x0b, data = "Hi There"
    const key = bytesToBinaryString(hexDecode('0b'.repeat(20)))
    const expected =
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'
    expect(await hmacSha256('Hi There', key)).toBe(expected)
  })

  it('produces a 64-character hex digest', async () => {
    const digest = await hmacSha256('anything', 'secret')
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input and secret', async () => {
    expect(await hmacSha256('x', 's')).toBe(await hmacSha256('x', 's'))
  })

  it('differs for different secrets', async () => {
    expect(await hmacSha256('x', 's1')).not.toBe(await hmacSha256('x', 's2'))
  })

  it('handles UTF-8 inputs and secrets', async () => {
    const digest = await hmacSha256('payload-中文-😀', 'sécret-üñîçødé')
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect(await hmacSha256('payload-中文-😀', 'sécret-üñîçødé')).toBe(digest)
  })

  it('handles an empty input', async () => {
    const digest = await hmacSha256('', 'secret')
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })
})
