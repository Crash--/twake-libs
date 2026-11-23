import { arrayBufferToBase64, utf8Encoder } from './internal/encoding.js'
import { getCrypto } from './internal/webcrypto.js'

/**
 * Compute a SHA-256 hash of a string and return it base64-encoded.
 *
 * Note the output is standard base64 (with `+`/`/` and `=` padding), not
 * base64url, and not hex like {@link hmacSha256}. Pick the encoding that
 * matches your storage/transport format.
 *
 * Isomorphic via Web Crypto.
 *
 * @param input - The string to hash. Encoded as UTF-8 before hashing.
 * @returns Base64-encoded SHA-256 digest (44 characters including padding).
 */
export const createSha256Hash = async (input: string): Promise<string> => {
  const digest = await getCrypto().subtle.digest(
    'SHA-256',
    utf8Encoder.encode(input)
  )
  return arrayBufferToBase64(digest)
}

/**
 * Constant-time string comparison.
 *
 * Pure JavaScript implementation - isomorphic, synchronous, and independent
 * of Node's `timingSafeEqual`. When lengths differ, walks the longer string
 * to keep runtime correlated with the expected length and not with the
 * mismatch position.
 *
 * Operates on UTF-16 code units. Inputs containing astral-plane characters
 * (surrogate pairs) will compare correctly but you almost certainly want to
 * compare hex/base64 digests with this, where every character is single-unit.
 *
 * @param provided - The value supplied by the caller (often attacker-controlled).
 * @param expected - The trusted reference value.
 * @returns `true` if the two strings are byte-equal, `false` otherwise. Also
 * returns `false` if either argument is empty.
 */
export const timingSafeStringEqual = (
  provided: string,
  expected: string
): boolean => {
  if (!provided || !expected) return false

  if (provided.length !== expected.length) {
    // Touch every character of `expected` so the runtime cost depends on
    // the expected length rather than where the comparison short-circuits.
    // `void acc` prevents the JIT (and the linter) from eliding the loop.
    let acc = 0
    for (let i = 0; i < expected.length; i++) acc |= expected.charCodeAt(i)
    void acc
    return false
  }

  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}
