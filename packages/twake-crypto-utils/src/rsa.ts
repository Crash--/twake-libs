import { CIPHER_VERSION_AES_CBC_HMAC } from './aes-cbc.js'
import { HMAC_SHA256_PARAMS } from './internal/constants.js'
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  concatBytes
} from './internal/encoding.js'
import { getCrypto, randomBytes } from './internal/webcrypto.js'
import type { KeyPair } from './types.js'

/**
 * Generate an RSA-OAEP 2048-bit keypair and wrap the private key under a
 * 64-byte symmetric key using AES-CBC + HMAC-SHA256 (cipher version `2`).
 *
 * The symmetric key must be 64 bytes: bytes [0..32) are the AES encryption
 * key, bytes [32..64) are the HMAC MAC key - used DIRECTLY without further
 * derivation. This differs from {@link decryptEncryptionKey}'s version-2
 * path, which expects a 32-byte master key and runs HKDF-Expand. The two
 * share a cipher-string version prefix but are not interoperable: to decrypt
 * a private key produced here, use {@link decryptKeyPairPrivateKey}.
 *
 * SECURITY NOTE: OAEP uses SHA-1 as the mask-generation hash. SHA-1 is
 * deprecated for new RSA-OAEP uses (NIST SP 800-131A) and is kept here only
 * to remain interoperable with existing ciphertexts. Do NOT change this hash
 * without a coordinated migration of all stored private keys.
 *
 * @param symmetricKey - 64 bytes; the layout produced by {@link makeEncryptionKey}.
 * @returns
 * - `publicKey`: base64-encoded SPKI public key.
 * - `privateKey`: `2.{iv}|{cipher}|{mac}` cipher string wrapping the PKCS8
 *   private key.
 * @throws if Web Crypto rejects the inputs (extremely unlikely with the
 * documented key layout).
 */
export const generateKeyPair = async (
  symmetricKey: Uint8Array
): Promise<KeyPair> => {
  const { subtle } = getCrypto()

  const encKey = symmetricKey.slice(0, 32)
  const macKey = symmetricKey.slice(32, 64)
  const iv = randomBytes(16)

  const pair = await subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: { name: 'SHA-1' }
    },
    true,
    ['encrypt', 'decrypt']
  )

  const [publicKey, privateKey] = await Promise.all([
    subtle.exportKey('spki', pair.publicKey),
    subtle.exportKey('pkcs8', pair.privateKey)
  ])

  const [impKey, macImpKey] = await Promise.all([
    subtle.importKey('raw', encKey, { name: 'AES-CBC' }, false, ['encrypt']),
    subtle.importKey('raw', macKey, HMAC_SHA256_PARAMS, false, ['sign'])
  ])

  const encryptedKey = await subtle.encrypt(
    { name: 'AES-CBC', iv },
    impKey,
    privateKey
  )
  const mac = await subtle.sign(
    HMAC_SHA256_PARAMS,
    macImpKey,
    concatBytes(iv, encryptedKey)
  )

  return {
    publicKey: arrayBufferToBase64(publicKey),
    privateKey: `${CIPHER_VERSION_AES_CBC_HMAC}.${arrayBufferToBase64(iv)}|${arrayBufferToBase64(
      encryptedKey
    )}|${arrayBufferToBase64(mac)}`
  }
}

/**
 * Decrypt a private key produced by {@link generateKeyPair}.
 *
 * Parses the version-2 cipher string, verifies the HMAC-SHA256 tag using
 * the second 32-byte half of `symmetricKey`, then decrypts the AES-CBC
 * ciphertext using the first 32-byte half. Returns the raw PKCS8 bytes.
 *
 * @throws if the cipher string is malformed, the version is not `2`, or
 * MAC verification fails.
 */
export const decryptKeyPairPrivateKey = async (
  cipherString: string,
  symmetricKey: Uint8Array
): Promise<ArrayBuffer> => {
  if (symmetricKey.byteLength !== 64) {
    throw new Error('symmetricKey must be 64 bytes (enc[0..32) || mac[32..64))')
  }

  const [version, rest] = cipherString.split('.')
  if (version !== CIPHER_VERSION_AES_CBC_HMAC || !rest) {
    throw new Error('Invalid or unsupported cipher string')
  }

  const [iv64, cipher64, mac64] = rest.split('|')
  if (!iv64 || !cipher64 || !mac64) {
    throw new Error('Invalid cipher string')
  }

  const iv = base64ToArrayBuffer(iv64)
  const cipherText = base64ToArrayBuffer(cipher64)
  const mac = base64ToArrayBuffer(mac64)

  const encKey = symmetricKey.slice(0, 32)
  const macKey = symmetricKey.slice(32, 64)

  const { subtle } = getCrypto()

  const [macImportKey, encImportKey] = await Promise.all([
    subtle.importKey('raw', macKey, HMAC_SHA256_PARAMS, false, ['verify']),
    subtle.importKey('raw', encKey, { name: 'AES-CBC' }, false, ['decrypt'])
  ])

  const valid = await subtle.verify(
    HMAC_SHA256_PARAMS,
    macImportKey,
    mac,
    concatBytes(iv, cipherText)
  )
  if (!valid) {
    throw new Error('MAC verification failed')
  }

  return subtle.decrypt({ name: 'AES-CBC', iv }, encImportKey, cipherText)
}
