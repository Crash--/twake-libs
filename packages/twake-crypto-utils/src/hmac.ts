import { HMAC_SHA256_PARAMS } from './internal/constants.js'
import { hexEncode, utf8Encoder } from './internal/encoding.js'
import { getCrypto } from './internal/webcrypto.js'
import { timingSafeStringEqual } from './sha256.js'

/**
 * Compute an HMAC-SHA256 hex digest of `input` keyed by `secret`.
 *
 * Useful for deriving opaque, deterministic keys from sensitive values so
 * the plaintext never has to be stored or held in memory longer than needed.
 *
 * Isomorphic via Web Crypto.
 *
 * @param input - UTF-8 string to authenticate.
 * @param secret - HMAC key. Encoded as UTF-8 before use.
 * @returns Lowercase hex-encoded 64-character digest.
 */
export const hmacSha256 = async (
  input: string,
  secret: string
): Promise<string> => {
  const { subtle } = getCrypto()
  const key = await subtle.importKey(
    'raw',
    utf8Encoder.encode(secret),
    HMAC_SHA256_PARAMS,
    false,
    ['sign']
  )
  const signature = await subtle.sign(
    HMAC_SHA256_PARAMS,
    key,
    utf8Encoder.encode(input)
  )
  return hexEncode(new Uint8Array(signature))
}

/**
 * Constant-time verification of an HMAC-SHA256 hex digest.
 *
 * Recomputes the digest of `input` under `secret` and compares it to
 * `expected` in constant time via {@link timingSafeStringEqual}. Use to
 * verify incoming webhook signatures, cookie HMACs, and any other tag
 * whose comparison would otherwise leak timing information.
 *
 * The HMAC is always computed before comparison so the timing of the
 * verification doesn't depend on whether `expected` has the right length
 * or shape.
 *
 * @param input - The signed payload to verify.
 * @param secret - The shared HMAC key.
 * @param expected - The hex-encoded digest supplied by the remote party.
 * @returns `true` on match, `false` on any mismatch (wrong length, wrong
 * content, or empty `expected`).
 * @throws if Web Crypto is unavailable.
 */
export const verifyHmacSha256 = async (
  input: string,
  secret: string,
  expected: string
): Promise<boolean> => {
  const computed = await hmacSha256(input, secret)
  return timingSafeStringEqual(computed, expected)
}
