import { beforeAll, describe, expect, it } from 'vitest'

import { CIPHER_VERSION_AES_CBC_HMAC, decryptEncryptionKey } from './aes-cbc.js'
import { hkdfExpand } from './hkdf.js'
import { HMAC_SHA256_PARAMS } from './internal/constants.js'
import {
  arrayBufferToBase64,
  concatBytes,
  utf8Encoder
} from './internal/encoding.js'
import { getCrypto, randomBytes } from './internal/webcrypto.js'

/**
 * Build a version-2 cipher string (`2.iv|cipher|mac`) using the HKDF-stretched
 * key derivation that `decryptEncryptionKey` expects on the v2 path. The
 * public API doesn't expose a matching encrypt helper, so the test builds
 * the ciphertext by hand to exercise the v2 decrypt branch.
 */
const buildVersion2 = async (
  masterKey: ArrayBuffer,
  plaintext: Uint8Array
): Promise<string> => {
  const { subtle } = getCrypto()
  const [encKey, macKey] = await Promise.all([
    hkdfExpand(masterKey, utf8Encoder.encode('enc'), 32),
    hkdfExpand(masterKey, utf8Encoder.encode('mac'), 32)
  ])
  const iv = randomBytes(16)
  const encImpKey = await subtle.importKey(
    'raw',
    encKey,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  )
  const macImpKey = await subtle.importKey(
    'raw',
    macKey,
    HMAC_SHA256_PARAMS,
    false,
    ['sign']
  )
  const cipherText = await subtle.encrypt(
    { name: 'AES-CBC', iv },
    encImpKey,
    plaintext
  )
  const mac = await subtle.sign(
    HMAC_SHA256_PARAMS,
    macImpKey,
    concatBytes(iv, cipherText)
  )
  return `${CIPHER_VERSION_AES_CBC_HMAC}.${arrayBufferToBase64(iv)}|${arrayBufferToBase64(
    cipherText
  )}|${arrayBufferToBase64(mac)}`
}

const flipFirstChar = (s: string): string =>
  (s.startsWith('A') ? 'B' : 'A') + s.slice(1)

/**
 * Split a `version.iv|cipher|mac` string into its segments. `parts[0]` is the
 * raw IV (version prefix already stripped) so tampering helpers don't
 * accidentally corrupt the version byte.
 */
const splitCipher = (s: string): { version: string; parts: string[] } => {
  const dot = s.indexOf('.')
  return { version: s.slice(0, dot), parts: s.slice(dot + 1).split('|') }
}

const joinCipher = (version: string, parts: string[]): string =>
  `${version}.${parts.join('|')}`

describe('decryptEncryptionKey - version 2 (AES-CBC + HMAC, HKDF-stretched master)', () => {
  // Share one valid (master, cipher) pair across the tampering tests - none of
  // them need a freshly-encrypted source, just a known-good v2 cipher to mutate.
  let master: Uint8Array
  let cipher: string
  let parts: { version: string; segments: string[] }

  beforeAll(async () => {
    master = randomBytes(32)
    cipher = await buildVersion2(master.buffer, randomBytes(64))
    const { version, parts: segments } = splitCipher(cipher)
    parts = { version, segments }
  })

  it('round-trips a plaintext through encrypt → decrypt', async () => {
    const localMaster = randomBytes(32)
    const plaintext = utf8Encoder.encode('hello world - version-2 round-trip')
    const localCipher = await buildVersion2(localMaster.buffer, plaintext)

    const decrypted = await decryptEncryptionKey(
      localCipher,
      localMaster.buffer
    )
    expect(new Uint8Array(decrypted)).toEqual(plaintext)
  })

  it('rejects a tampered IV with MAC verification failure', async () => {
    const tampered = [...parts.segments]
    tampered[0] = flipFirstChar(tampered[0])
    await expect(
      decryptEncryptionKey(joinCipher(parts.version, tampered), master.buffer)
    ).rejects.toThrow('MAC verification failed')
  })

  it('rejects a tampered ciphertext with MAC verification failure', async () => {
    const tampered = [...parts.segments]
    tampered[1] = flipFirstChar(tampered[1])
    await expect(
      decryptEncryptionKey(joinCipher(parts.version, tampered), master.buffer)
    ).rejects.toThrow('MAC verification failed')
  })

  it('rejects a tampered MAC', async () => {
    const tampered = [...parts.segments]
    tampered[2] = flipFirstChar(tampered[2])
    await expect(
      decryptEncryptionKey(joinCipher(parts.version, tampered), master.buffer)
    ).rejects.toThrow('MAC verification failed')
  })

  it('rejects a wrong master key', async () => {
    const other = randomBytes(32)
    await expect(decryptEncryptionKey(cipher, other.buffer)).rejects.toThrow(
      'MAC verification failed'
    )
  })

  it('rejects a version-2 string with a missing MAC segment', async () => {
    const stripped = joinCipher(parts.version, parts.segments.slice(0, 2))
    await expect(decryptEncryptionKey(stripped, master.buffer)).rejects.toThrow(
      'Invalid cipher string'
    )
  })
})
