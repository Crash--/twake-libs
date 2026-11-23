import { randomBytes } from 'node:crypto'

import { beforeAll, describe, expect, it } from 'vitest'

import { decryptKeyPairPrivateKey, generateKeyPair } from './rsa.js'

describe('decryptKeyPairPrivateKey', () => {
  // RSA-2048 generation is the slowest op in the suite; share one keypair
  // across every test that just needs a valid wrapped cipher.
  let symmetricKey: Uint8Array
  let wrappedPrivateKey: string

  beforeAll(async () => {
    symmetricKey = new Uint8Array(randomBytes(64))
    const pair = await generateKeyPair(symmetricKey)
    wrappedPrivateKey = pair.privateKey
  })

  it('round-trips through generateKeyPair → decryptKeyPairPrivateKey', async () => {
    const pkcs8 = await decryptKeyPairPrivateKey(
      wrappedPrivateKey,
      symmetricKey
    )

    // PKCS8 for a 2048-bit RSA private key is around 1.2 KB
    expect(pkcs8.byteLength).toBeGreaterThan(1000)
    expect(pkcs8.byteLength).toBeLessThan(2000)
  })

  it('fails MAC verification on a tampered cipher', async () => {
    const tamperedPriv = wrappedPrivateKey.slice(0, -2) + 'AA'
    await expect(
      decryptKeyPairPrivateKey(tamperedPriv, symmetricKey)
    ).rejects.toThrow('MAC verification failed')
  })

  it('fails on a wrong symmetric key', async () => {
    const other = new Uint8Array(randomBytes(64))
    await expect(
      decryptKeyPairPrivateKey(wrappedPrivateKey, other)
    ).rejects.toThrow('MAC verification failed')
  })

  it('rejects a malformed cipher string', async () => {
    await expect(
      decryptKeyPairPrivateKey('bogus', symmetricKey)
    ).rejects.toThrow()
    await expect(
      decryptKeyPairPrivateKey('0.x|y|z', symmetricKey)
    ).rejects.toThrow('Invalid or unsupported')
    await expect(
      decryptKeyPairPrivateKey('2.only|two', symmetricKey)
    ).rejects.toThrow('Invalid cipher string')
  })

  it('rejects a symmetric key of the wrong length', async () => {
    const short = new Uint8Array(32)
    await expect(decryptKeyPairPrivateKey('2.x|y|z', short)).rejects.toThrow(
      'must be 64 bytes'
    )
  })
})
