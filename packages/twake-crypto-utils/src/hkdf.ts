import { HMAC_SHA256_PARAMS } from './internal/constants.js'
import { getCrypto } from './internal/webcrypto.js'

const HASH_LEN = 32
const MAX_BLOCKS = 255

/**
 * HKDF-Expand (RFC 5869, section 2.3) using HMAC-SHA256.
 *
 * Expands a pseudorandom key `prk` into output keying material of `length`
 * bytes, optionally bound to a context string `info`. Caller is responsible
 * for providing a uniformly random `prk` (e.g. the output of HKDF-Extract
 * or a key already derived from a strong source).
 *
 * Use to derive multiple distinct subkeys from a single master key. Pass a
 * different `info` per subkey (`"enc"`, `"mac"`, `"prefix-v2"`, etc.) so
 * the same `prk` never collides across uses.
 *
 * @throws if `length` would require more than 255 HMAC iterations (HKDF's
 * hard upper bound for SHA-256: 255 * 32 = 8160 bytes).
 */
export const hkdfExpand = async (
  prk: ArrayBuffer | Uint8Array,
  info: Uint8Array,
  length: number
): Promise<ArrayBuffer> => {
  const blocks = Math.ceil(length / HASH_LEN)
  if (blocks > MAX_BLOCKS) {
    throw new Error('hkdfExpand: requested length exceeds 255 * HashLen')
  }

  const prkBytes = new Uint8Array(new ArrayBuffer(prk.byteLength))
  prkBytes.set(prk instanceof Uint8Array ? prk : new Uint8Array(prk))

  const { subtle } = getCrypto()
  const key = await subtle.importKey(
    'raw',
    prkBytes,
    HMAC_SHA256_PARAMS,
    false,
    ['sign']
  )

  const result = new Uint8Array(new ArrayBuffer(length))
  let prev = new Uint8Array(0)
  let written = 0

  for (let i = 1; i <= blocks; i++) {
    const input = new Uint8Array(
      new ArrayBuffer(prev.byteLength + info.byteLength + 1)
    )
    input.set(prev, 0)
    input.set(info, prev.byteLength)
    input[prev.byteLength + info.byteLength] = i

    const t = new Uint8Array(await subtle.sign(HMAC_SHA256_PARAMS, key, input))
    const take = Math.min(HASH_LEN, length - written)
    result.set(t.subarray(0, take), written)
    written += take
    prev = t
  }

  return result.buffer
}
