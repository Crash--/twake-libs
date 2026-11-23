/**
 * Shared `TextEncoder` / `TextDecoder` instances. Both are stateless and
 * cheap to construct, but reusing one instance avoids per-call allocation
 * across the package's hot paths (HMAC, SHA-256, AES, PBKDF2, HKDF, JWT).
 */
export const utf8Encoder = new TextEncoder()
export const utf8Decoder = new TextDecoder('utf-8')

/**
 * Encode bytes as a standard base64 string (with `+`/`/` and `=` padding).
 *
 * Isomorphic: relies on `btoa`, which is available in all browsers and in
 * Node 16+ as a global.
 */
export const arrayBufferToBase64 = (
  buffer: ArrayBuffer | Uint8Array
): string => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)

  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  return btoa(binary)
}

/**
 * Decode a standard base64 string to an `ArrayBuffer`.
 *
 * Isomorphic: relies on `atob`, available in all browsers and in Node 16+.
 */
export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(new ArrayBuffer(len))

  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes.buffer
}

/**
 * Decodes a hex string to a Uint8Array.
 */
export const hexDecode = (str: string): Uint8Array => {
  if (str.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length')
  }

  const out = new Uint8Array(str.length / 2)
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(str.substr(i * 2, 2), 16)
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex string at offset ${i * 2}`)
    }
    out[i] = byte
  }
  return out
}

/**
 * Encodes a Uint8Array or Buffer to a hex string.
 */
export const hexEncode = (buf: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < buf.length; i++) {
    s += buf[i].toString(16).padStart(2, '0')
  }
  return s
}

/**
 * Encode bytes as base64url (RFC 4648 §5): standard base64 with `-`/`_`
 * substituted for `+`/`/` and trailing `=` padding stripped. Safe to embed
 * in URLs and JWT headers/payloads without further escaping.
 */
export const base64UrlEncode = (buffer: ArrayBuffer | Uint8Array): string =>
  arrayBufferToBase64(buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/**
 * Decode a base64url string back to an ArrayBuffer. Accepts input with or
 * without padding.
 */
export const base64UrlDecode = (input: string): ArrayBuffer => {
  let s = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad === 2) s += '=='
  else if (pad === 3) s += '='
  else if (pad === 1) throw new Error('Invalid base64url string')
  return base64ToArrayBuffer(s)
}

/**
 * Concatenates two byte buffers into a single new Uint8Array.
 * Used by AES-CBC+HMAC routines to build MAC input as `iv || ciphertext`.
 */
export const concatBytes = (
  a: ArrayBuffer | Uint8Array,
  b: ArrayBuffer | Uint8Array
): Uint8Array => {
  const aBytes = a instanceof Uint8Array ? a : new Uint8Array(a)
  const bBytes = b instanceof Uint8Array ? b : new Uint8Array(b)
  const out = new Uint8Array(
    new ArrayBuffer(aBytes.byteLength + bBytes.byteLength)
  )
  out.set(aBytes, 0)
  out.set(bBytes, aBytes.byteLength)
  return out
}
