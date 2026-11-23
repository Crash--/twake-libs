/**
 * Returns the Web Crypto API for the current runtime. Synchronous because
 * `globalThis.crypto` has been unconditionally available in browsers for
 * years and in Node since 19.x (unflagged).
 *
 * The reference is cached at module level on first successful call -
 * `globalThis.crypto` is immutable for the lifetime of a runtime, so we
 * skip the availability check on every subsequent invocation.
 *
 * @throws if Web Crypto is unavailable (very old Node, non-browser sandbox).
 */
let cachedCrypto: Crypto | undefined
export const getCrypto = (): Crypto => {
  if (cachedCrypto) return cachedCrypto
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new Error(
      '@linagora/twake-crypto-utils requires the Web Crypto API. ' +
        'Use Node 24+ or a modern browser.'
    )
  }
  cachedCrypto = globalThis.crypto
  return cachedCrypto
}

/**
 * Allocate a fresh `Uint8Array` of `length` bytes and fill it with
 * cryptographically secure random data via `crypto.getRandomValues`.
 *
 * Isomorphic and synchronous.
 */
export const randomBytes = (length: number): Uint8Array => {
  const buf = new Uint8Array(new ArrayBuffer(length))
  getCrypto().getRandomValues(buf)
  return buf
}
