import { randomBytes } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  CIPHER_VERSION_AES_CBC,
  decryptEncryptionKey,
  encryptEncryptionKey,
  makeEncryptionKey
} from './aes-cbc.js'

describe('AES-CBC encryption key wrapping', () => {
  it('makeEncryptionKey returns a 64-byte key and a version-0 cipher string', async () => {
    const masterKey = randomBytes(32).buffer
    const wrapped = await makeEncryptionKey(masterKey)

    expect(wrapped.key.length).toBe(64)
    expect(wrapped.cipherString.startsWith(`${CIPHER_VERSION_AES_CBC}.`)).toBe(
      true
    )
    expect(wrapped.cipherString.split('|').length).toBe(2)
  })

  it('round-trips through encrypt/decrypt for version 0', async () => {
    const masterKey = randomBytes(32).buffer
    const payload = randomBytes(64).buffer

    const cipher = await encryptEncryptionKey(payload, masterKey)
    const decrypted = await decryptEncryptionKey(cipher, masterKey)

    expect(Array.from(new Uint8Array(decrypted))).toEqual(
      Array.from(new Uint8Array(payload))
    )
  })

  it('decryptEncryptionKey rejects a malformed cipher string', async () => {
    const masterKey = randomBytes(32).buffer
    await expect(decryptEncryptionKey('bogus', masterKey)).rejects.toThrow(
      'Invalid cipher string'
    )
    await expect(
      decryptEncryptionKey('0.only-one-part', masterKey)
    ).rejects.toThrow('Invalid cipher string')
  })

  it('decryptEncryptionKey rejects an unsupported version', async () => {
    const masterKey = randomBytes(32).buffer
    await expect(decryptEncryptionKey('9.aa|bb', masterKey)).rejects.toThrow(
      'Unsupported cipher string version'
    )
  })
})
