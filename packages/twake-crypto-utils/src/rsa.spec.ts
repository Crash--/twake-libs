import { randomBytes } from 'node:crypto'

import { beforeAll, describe, expect, it } from 'vitest'

import { CIPHER_VERSION_AES_CBC_HMAC } from './aes-cbc.js'
import { generateKeyPair } from './rsa.js'

describe('generateKeyPair', () => {
  let symmetricKey: Uint8Array
  let publicKey: string
  let privateKey: string

  beforeAll(async () => {
    symmetricKey = new Uint8Array(randomBytes(64))
    const pair = await generateKeyPair(symmetricKey)
    publicKey = pair.publicKey
    privateKey = pair.privateKey
  })

  it('returns a base64 public key and a version-2 wrapped private key', () => {
    expect(publicKey).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(privateKey.startsWith(`${CIPHER_VERSION_AES_CBC_HMAC}.`)).toBe(true)
    expect(privateKey.split('|').length).toBe(3)
  })

  it('produces three non-empty base64 segments in the private key', () => {
    const [version, body] = privateKey.split('.')
    expect(version).toBe(CIPHER_VERSION_AES_CBC_HMAC)
    const [iv, cipher, mac] = body.split('|')
    expect(iv.length).toBeGreaterThan(0)
    expect(cipher.length).toBeGreaterThan(0)
    expect(mac.length).toBeGreaterThan(0)
  })

  it('produces a fresh ciphertext on each call (fresh IV)', async () => {
    const other = await generateKeyPair(symmetricKey)
    expect(other.privateKey).not.toBe(privateKey)
  })
})
