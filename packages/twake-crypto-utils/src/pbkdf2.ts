import { arrayBufferToBase64, utf8Encoder } from './internal/encoding.js'
import { getCrypto } from './internal/webcrypto.js'
import type { PBKDF2Config, PBKDF2HashedPassword } from './types.js'

/**
 * Two-stage PBKDF2 hash using HMAC-SHA256.
 *
 * Stage 1: derives a 256-bit master key from `password` and `salt` over `iterations` rounds.
 * Stage 2: derives the stored password hash from that master key with a single iteration
 * using `password` as the second-stage salt.
 *
 * Designed for client-side key derivation: the master key never leaves the client
 * and is used downstream to derive a per-user encryption key, while only the
 * stage-2 hash is sent to the server for password verification.
 *
 * @param password - The user-supplied password. Encoded as UTF-8 before hashing.
 * @param salt - Per-account salt; typically a domain-scoped string.
 * @param iterations - Stage-1 iteration count. OWASP recommends >= 600,000 for SHA-256.
 * @returns An object with `hashed` (base64-encoded stage-2 hash) and `masterKey`
 * (raw stage-1 output, 32 bytes) on success, or `null` if Web Crypto rejects
 * any step. Failure is returned (not thrown) so callers can fall through to
 * generic auth error paths without try/catch noise.
 */
export const pbkdf2Hash = async (
  password: string,
  salt: string,
  iterations: number
): Promise<PBKDF2HashedPassword | null> => {
  try {
    const { subtle } = getCrypto()

    const passwordBuff = utf8Encoder.encode(password)
    const saltBuff = utf8Encoder.encode(salt)

    const masterMaterial = await subtle.importKey(
      'raw',
      passwordBuff,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )

    const masterKey = await subtle.deriveBits(
      pbkdf2Params(saltBuff, iterations),
      masterMaterial,
      256
    )

    const passwordMaterial = await subtle.importKey(
      'raw',
      masterKey,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    )

    const hashedPassword = await subtle.deriveBits(
      pbkdf2Params(passwordBuff, 1),
      passwordMaterial,
      256
    )

    return { hashed: arrayBufferToBase64(hashedPassword), masterKey }
  } catch {
    return null
  }
}

const pbkdf2Params = (salt: Uint8Array, iters: number): PBKDF2Config => ({
  name: 'PBKDF2',
  hash: 'SHA-256',
  salt,
  iterations: iters
})
