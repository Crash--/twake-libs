import { scryptSync } from 'node:crypto'

import { hexDecode, hexEncode } from './internal/encoding.js'
import type { ScryptHash } from './types.js'

/**
 * Serialize scrypt parameters and derived key into a `$`-delimited string:
 * `scrypt$N$r$p$saltHex$dkHex`.
 *
 * Compact, self-describing format suitable for storing alongside a user record.
 *
 * @param n - CPU/memory cost parameter.
 * @param r - Block size parameter.
 * @param p - Parallelization parameter.
 * @param salt - Salt bytes (encoded as lowercase hex in the output).
 * @param dk - Derived key bytes (encoded as lowercase hex in the output).
 */
export const marshalScryptText = (
  n: number,
  r: number,
  p: number,
  salt: Uint8Array,
  dk: Uint8Array
): string => `scrypt$${n}$${r}$${p}$${hexEncode(salt)}$${hexEncode(dk)}`

/**
 * Parse a marshaled scrypt string back into its parameters and derived key.
 *
 * @param input - String produced by {@link marshalScryptText}.
 * @returns The parsed scrypt parameters plus the derived key bytes.
 * @throws if the prefix is not `scrypt`, if the field count is wrong, or if
 * `n`/`r`/`p` are not parseable integers.
 */
export const unmarshalScryptText = (input: string): ScryptHash => {
  const parts = input.split('$')

  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    throw new Error('Invalid hash format')
  }

  const [, nStr, rStr, pStr, saltHex, dkHex] = parts
  const n = parseInt(nStr, 10)
  const r = parseInt(rStr, 10)
  const p = parseInt(pStr, 10)
  const salt = hexDecode(saltHex)
  const dk = hexDecode(dkHex)

  if ([n, r, p].some(Number.isNaN)) {
    throw new Error('Invalid hash parameters')
  }

  return { n, r, p, salt, dk, dkLen: dk.length }
}

/**
 * Compute an scrypt hash and return it serialized via {@link marshalScryptText}.
 *
 * `maxmem` is fixed at 64 MiB which fits the typical (N=16384, r=8, p=1) parameter
 * set; the call will throw if N/r/p collectively exceed that budget.
 *
 * Synchronous and Node-only (Web Crypto has no scrypt primitive).
 *
 * @param password - The password to hash. Strings are encoded as UTF-8 by Node.
 * @param salt - A unique per-password salt. 16 bytes is the conventional minimum.
 * @param n - CPU/memory cost parameter. Must be a power of two greater than 1.
 * @param r - Block size parameter.
 * @param p - Parallelization parameter.
 * @param length - Output key length in bytes (the `dkLen` field of the result).
 * @returns Marshaled scrypt string `scrypt$N$r$p$saltHex$dkHex`.
 * @throws if `n` is not a power of two, if the resulting memory cost exceeds
 * 64 MiB, or if the underlying `scryptSync` rejects the parameters.
 */
export const generateScryptHash = (
  password: string,
  salt: Uint8Array,
  n: number,
  r: number,
  p: number,
  length: number
): string => {
  const derivedKey = scryptSync(password, salt, length, {
    N: n,
    r,
    p,
    maxmem: 64 * 1024 * 1024
  })

  return marshalScryptText(n, r, p, salt, new Uint8Array(derivedKey))
}

/**
 * Parse a base64-wrapped scrypt hash back into its parameters and derived key.
 *
 * Convenience for the common storage shape where the marshaled scrypt string
 * is base64-encoded for safe transport. Equivalent to:
 * `unmarshalScryptText(atob(base64))`.
 *
 * @param base64ScryptHash - Base64-encoded marshaled scrypt string.
 * @returns The parsed scrypt parameters plus the derived key bytes.
 * @throws if the base64 decodes to a string that is not a valid scrypt hash.
 */
export const extractScryptParameters = (base64ScryptHash: string): ScryptHash =>
  unmarshalScryptText(atob(base64ScryptHash))
