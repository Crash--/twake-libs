import { base64UrlDecode, utf8Decoder } from './internal/encoding.js'

/**
 * Decoded JWT payload. Values are unknown to force callers through
 * {@link getJwtStringProperty} or their own narrowing.
 */
export type JwtPayload = Record<string, unknown>

/**
 * Decode a JWT payload without signature verification.
 *
 * WARNING: this does NOT verify the signature. Only use on tokens received
 * over a trusted channel (your own session store, a direct back-channel
 * call to your IdP token endpoint). For tokens from untrusted sources,
 * use a JWT verification library like `jose`.
 *
 * @param token - JWT in compact serialization (`header.payload.signature`).
 * @returns The parsed payload, or `null` if the token is malformed.
 */
export const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const payload = parts[1]
    if (!payload) return null

    const bytes = new Uint8Array(base64UrlDecode(payload))
    const json = utf8Decoder.decode(bytes)
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

/**
 * Safely read a string property from a decoded JWT payload. Returns
 * `undefined` if the payload is null or the property is not a string.
 */
export const getJwtStringProperty = (
  payload: JwtPayload | null,
  key: string
): string | undefined => {
  if (!payload || typeof payload[key] !== 'string') return undefined
  return payload[key]
}
