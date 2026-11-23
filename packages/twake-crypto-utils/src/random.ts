import { hexEncode } from './internal/encoding.js'
import { randomBytes } from './internal/webcrypto.js'

const DEFAULT_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Generate a hex-encoded cryptographically secure random token.
 *
 * Use for opaque tokens (OAuth state/nonce, password-reset tokens, API keys)
 * where the value is never displayed to a user.
 *
 * Isomorphic and synchronous.
 *
 * @param bytes - Number of random bytes (output length is `bytes * 2` hex chars).
 */
export const generateRandomToken = (bytes: number = 32): string =>
  hexEncode(randomBytes(bytes))

/**
 * Generate a random string of `length` characters drawn from `alphabet`.
 *
 * Uses `getRandomValues` for unbiased sampling via rejection: bytes that
 * fall outside the largest multiple of `alphabet.length` (i.e. `floor(256/N)*N`)
 * are discarded so each character is uniformly distributed.
 *
 * Default alphabet is `[A-Za-z0-9]` (62 chars), suitable for human-readable
 * tokens and short identifiers.
 *
 * Isomorphic and synchronous.
 *
 * @throws if `alphabet` is empty or longer than 256 characters (modulo-bias
 * rejection requires the alphabet fit in one byte's range).
 */
export const generateRandomString = (
  length: number,
  alphabet: string = DEFAULT_ALPHABET
): string => {
  if (alphabet.length === 0 || alphabet.length > 256) {
    throw new Error('alphabet must contain between 1 and 256 characters')
  }

  const max = Math.floor(256 / alphabet.length) * alphabet.length

  let out = ''
  while (out.length < length) {
    const batch = randomBytes(Math.max(length - out.length, 16))
    for (let i = 0; i < batch.length && out.length < length; i++) {
      if (batch[i] < max) {
        out += alphabet.charAt(batch[i] % alphabet.length)
      }
    }
  }
  return out
}
