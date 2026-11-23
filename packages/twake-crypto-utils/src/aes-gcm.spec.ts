import { beforeAll, describe, expect, it } from 'vitest'

import { decryptAesGcm, deriveAesGcmKey, encryptAesGcm } from './aes-gcm.js'
import { base64UrlDecode } from './internal/encoding.js'

describe('AES-GCM session crypto', () => {
  const secret = 'a'.repeat(32)
  let key: CryptoKey
  let otherKey: CryptoKey

  beforeAll(async () => {
    key = await deriveAesGcmKey(secret)
    otherKey = await deriveAesGcmKey('b'.repeat(32))
  })

  it('round-trips plaintext through encrypt/decrypt', async () => {
    const plaintext = 'session payload with non-ascii: éàü'
    const token = await encryptAesGcm(plaintext, key)
    expect(await decryptAesGcm(token, key)).toBe(plaintext)
  })

  it('produces a different ciphertext for each call (fresh IV)', async () => {
    const a = await encryptAesGcm('same', key)
    const b = await encryptAesGcm('same', key)
    expect(a).not.toBe(b)
  })

  it('returns null on a tampered token', async () => {
    const token = await encryptAesGcm('payload', key)
    const tampered =
      token.slice(0, -2) + (token.slice(-2) === 'AA' ? 'BB' : 'AA')
    expect(await decryptAesGcm(tampered, key)).toBeNull()
  })

  it('returns null on a token decrypted with the wrong key', async () => {
    const token = await encryptAesGcm('payload', key)
    expect(await decryptAesGcm(token, otherKey)).toBeNull()
  })

  it('returns null on garbage input', async () => {
    expect(await decryptAesGcm('not-a-token', key)).toBeNull()
    expect(await decryptAesGcm('', key)).toBeNull()
  })

  it('deriveAesGcmKey rejects a short secret', async () => {
    await expect(deriveAesGcmKey('short')).rejects.toThrow(
      'at least 32 characters'
    )
    await expect(deriveAesGcmKey('')).rejects.toThrow('at least 32 characters')
  })

  it('round-trips UTF-8 plaintext with astral-plane characters', async () => {
    const plaintext = 'mixed: ASCII 中文 العربية 😀🔐 αβγ'
    const token = await encryptAesGcm(plaintext, key)
    expect(await decryptAesGcm(token, key)).toBe(plaintext)
  })

  it('round-trips an empty plaintext', async () => {
    const token = await encryptAesGcm('', key)
    expect(await decryptAesGcm(token, key)).toBe('')
  })

  it('produces a fresh IV on each call (first 12 bytes differ)', async () => {
    const a = await encryptAesGcm('payload', key)
    const b = await encryptAesGcm('payload', key)
    const aIv = new Uint8Array(base64UrlDecode(a)).slice(0, 12)
    const bIv = new Uint8Array(base64UrlDecode(b)).slice(0, 12)
    expect(aIv).not.toEqual(bIv)
  })

  it('returns null on a payload shorter than iv+tag', async () => {
    // 12 + 16 = 28 bytes minimum; 27 bytes is shorter and must be rejected.
    const tooShort = Buffer.from(new Uint8Array(27)).toString('base64url')
    expect(await decryptAesGcm(tooShort, key)).toBeNull()
  })
})
