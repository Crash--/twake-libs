import { hkdfExpand } from './hkdf.js'
import { HMAC_SHA256_PARAMS } from './internal/constants.js'
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  concatBytes,
  utf8Encoder
} from './internal/encoding.js'
import { getCrypto, randomBytes } from './internal/webcrypto.js'
import type { EncryptionKey } from './types.js'

/** AesCbc256_B64 - AES-CBC encryption, no MAC. */
export const CIPHER_VERSION_AES_CBC = '0'

/** AesCbc256_HmacSha256_B64 - AES-CBC encryption + HMAC-SHA256 MAC. */
export const CIPHER_VERSION_AES_CBC_HMAC = '2'

/**
 * Generate a fresh 64-byte symmetric key and wrap it under `masterKey` using AES-CBC.
 *
 * Returns the wrapped cipher string (version `0`) and the raw key bytes. The raw
 * key is split downstream: bytes [0..32) are the AES encryption key and bytes
 * [32..64) are the HMAC-SHA256 MAC key.
 *
 * @param masterKey - Raw bytes of the AES-CBC wrapping key (16, 24, or 32 bytes).
 * @returns The wrapped `cipherString` and the raw 64-byte `key`.
 * @throws if Web Crypto rejects the master key (wrong length for AES-CBC).
 */
export const makeEncryptionKey = async (
  masterKey: ArrayBuffer
): Promise<EncryptionKey> => {
  const { subtle } = getCrypto()

  const encKey = randomBytes(64)
  const iv = randomBytes(16)

  const importKey = await subtle.importKey(
    'raw',
    masterKey,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  )
  const cipherText = await subtle.encrypt(
    { name: 'AES-CBC', iv },
    importKey,
    encKey
  )

  const iv64 = arrayBufferToBase64(iv)
  const cipher64 = arrayBufferToBase64(cipherText)

  return {
    cipherString: `${CIPHER_VERSION_AES_CBC}.${iv64}|${cipher64}`,
    key: encKey
  }
}

/**
 * Wrap an arbitrary key under `masterKey` using AES-CBC. Used to re-wrap an existing
 * encryption key under a new master key during password changes.
 *
 * @param key - Bytes to encrypt (the key being re-wrapped).
 * @param masterKey - The new wrapping key (16, 24, or 32 bytes for AES-CBC).
 * @returns A version-0 cipher string `0.{iv}|{cipher}`.
 * @throws if Web Crypto rejects the master key length.
 */
export const encryptEncryptionKey = async (
  key: ArrayBuffer,
  masterKey: ArrayBuffer
): Promise<string> => {
  const { subtle } = getCrypto()

  const iv = randomBytes(16)

  const importKey = await subtle.importKey(
    'raw',
    masterKey,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  )
  const cipherText = await subtle.encrypt(
    { name: 'AES-CBC', iv },
    importKey,
    key
  )

  const iv64 = arrayBufferToBase64(iv)
  const cipher64 = arrayBufferToBase64(cipherText)

  return `${CIPHER_VERSION_AES_CBC}.${iv64}|${cipher64}`
}

/**
 * Stretch a 32-byte master key into 32-byte encryption + 32-byte MAC keys
 * using HKDF-Expand (RFC 5869) with HMAC-SHA256.
 */
const stretchMasterKey = async (
  masterKey: ArrayBuffer
): Promise<{ encKey: ArrayBuffer; macKey: ArrayBuffer }> => {
  const [encKey, macKey] = await Promise.all([
    hkdfExpand(masterKey, utf8Encoder.encode('enc'), 32),
    hkdfExpand(masterKey, utf8Encoder.encode('mac'), 32)
  ])
  return { encKey, macKey }
}

/**
 * Decrypt a wrapped encryption key.
 *
 * Supports both cipher string formats:
 * - Version `0` (`AesCbc256_B64`): `0.{iv}|{cipher}` - uses master key directly.
 * - Version `2` (`AesCbc256_HmacSha256_B64`): `2.{iv}|{cipher}|{mac}` - stretches
 *   the master key via HKDF-Expand into enc + mac keys and verifies the MAC
 *   before decrypting.
 *
 * @throws if the cipher string is malformed, the version is unsupported, or
 * MAC verification fails on a version-2 string.
 */
export const decryptEncryptionKey = async (
  cipherString: string,
  masterKey: ArrayBuffer
): Promise<ArrayBuffer> => {
  const { subtle } = getCrypto()

  const [version, rest] = cipherString.split('.')

  if (!rest || version.length !== 1) {
    throw new Error('Invalid cipher string')
  }

  const parts = rest.split('|')

  if (version === CIPHER_VERSION_AES_CBC) {
    const [iv64, cipher64] = parts

    if (!iv64 || !cipher64) {
      throw new Error('Invalid cipher string')
    }

    const iv = base64ToArrayBuffer(iv64)
    const cipherText = base64ToArrayBuffer(cipher64)

    const importKey = await subtle.importKey(
      'raw',
      masterKey,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    )

    return subtle.decrypt({ name: 'AES-CBC', iv }, importKey, cipherText)
  }

  if (version === CIPHER_VERSION_AES_CBC_HMAC) {
    const [iv64, cipher64, mac64] = parts

    if (!iv64 || !cipher64 || !mac64) {
      throw new Error('Invalid cipher string')
    }

    const iv = base64ToArrayBuffer(iv64)
    const cipherText = base64ToArrayBuffer(cipher64)
    const mac = base64ToArrayBuffer(mac64)

    const { encKey, macKey } = await stretchMasterKey(masterKey)

    const macImportKey = await subtle.importKey(
      'raw',
      macKey,
      HMAC_SHA256_PARAMS,
      false,
      ['verify']
    )
    const valid = await subtle.verify(
      HMAC_SHA256_PARAMS,
      macImportKey,
      mac,
      concatBytes(iv, cipherText)
    )

    if (!valid) {
      throw new Error('MAC verification failed')
    }

    const encImportKey = await subtle.importKey(
      'raw',
      encKey,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    )

    return subtle.decrypt({ name: 'AES-CBC', iv }, encImportKey, cipherText)
  }

  throw new Error('Unsupported cipher string version')
}
