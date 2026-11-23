import {
  base64UrlDecode,
  base64UrlEncode,
  concatBytes,
  utf8Decoder,
  utf8Encoder
} from './internal/encoding.js'
import { getCrypto, randomBytes } from './internal/webcrypto.js'

const IV_BYTES = 12
const TAG_BYTES = 16
// Smallest valid payload: 12-byte IV + 16-byte GCM tag (zero-byte plaintext is legal).
const MIN_PAYLOAD_BYTES = IV_BYTES + TAG_BYTES

/**
 * Derive a 32-byte AES-256-GCM `CryptoKey` from a string secret via SHA-256.
 *
 * The secret must be at least 32 characters. Call once at startup and reuse
 * the returned `CryptoKey` across every `encryptAesGcm`/`decryptAesGcm` call -
 * `CryptoKey` is an opaque handle that doesn't need re-importing.
 *
 * Isomorphic via Web Crypto.
 *
 * @throws if `secret` is shorter than 32 characters.
 */
export const deriveAesGcmKey = async (secret: string): Promise<CryptoKey> => {
  if (!secret || secret.length < 32) {
    throw new Error('secret must be at least 32 characters')
  }
  const { subtle } = getCrypto()
  const hashed = await subtle.digest('SHA-256', utf8Encoder.encode(secret))
  return subtle.importKey('raw', hashed, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt'
  ])
}

/**
 * Encrypt a UTF-8 plaintext with AES-256-GCM and return a base64url-encoded
 * payload of `iv || ciphertext+tag` (12 + N + 16 bytes).
 *
 * Each call uses a fresh random IV. Suitable for short-lived secrets like
 * session cookies and OIDC state where the storage format is opaque to
 * anything but this library.
 *
 * Isomorphic via Web Crypto.
 *
 * @param plaintext - UTF-8 string to encrypt.
 * @param key - CryptoKey from {@link deriveAesGcmKey}.
 * @returns Base64url-encoded payload.
 */
export const encryptAesGcm = async (
  plaintext: string,
  key: CryptoKey
): Promise<string> => {
  const iv = randomBytes(IV_BYTES)
  const ciphertext = await getCrypto().subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    utf8Encoder.encode(plaintext)
  )
  return base64UrlEncode(concatBytes(iv, ciphertext))
}

/**
 * Decrypt a payload produced by {@link encryptAesGcm}.
 *
 * Returns `null` on any failure (malformed payload, wrong key, tampered
 * ciphertext) instead of throwing - call sites typically branch on whether
 * the cookie is valid and exceptions would force them to wrap every call
 * in try/catch.
 *
 * @param token - Base64url payload from {@link encryptAesGcm}.
 * @param key - CryptoKey from {@link deriveAesGcmKey}.
 * @returns The decrypted UTF-8 plaintext, or `null`.
 */
export const decryptAesGcm = async (
  token: string,
  key: CryptoKey
): Promise<string | null> => {
  try {
    const data = new Uint8Array(base64UrlDecode(token))
    if (data.byteLength < MIN_PAYLOAD_BYTES) return null

    const iv = data.subarray(0, IV_BYTES)
    const ciphertext = data.subarray(IV_BYTES)

    const plaintext = await getCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )
    return utf8Decoder.decode(plaintext)
  } catch {
    return null
  }
}
