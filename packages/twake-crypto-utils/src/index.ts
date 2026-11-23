// Main barrel - isomorphic helpers that work in any runtime with the Web
// Crypto API (Node 24+, Bun, Deno, modern browsers).
//
// scrypt is the one exception: it has no Web Crypto primitive. Import it
// from '@linagora/twake-crypto-utils/node' on a Node-compatible runtime.

export * from './types.js'

export { pbkdf2Hash } from './pbkdf2.js'

export { hkdfExpand } from './hkdf.js'

export {
  CIPHER_VERSION_AES_CBC,
  CIPHER_VERSION_AES_CBC_HMAC,
  makeEncryptionKey,
  encryptEncryptionKey,
  decryptEncryptionKey
} from './aes-cbc.js'

export { deriveAesGcmKey, encryptAesGcm, decryptAesGcm } from './aes-gcm.js'

export { generateKeyPair, decryptKeyPairPrivateKey } from './rsa.js'

export { hmacSha256, verifyHmacSha256 } from './hmac.js'
export { createSha256Hash, timingSafeStringEqual } from './sha256.js'

export { generateRandomToken, generateRandomString } from './random.js'

export {
  validateCnilPasswordComplexity,
  validatePasswordComplexity
} from './password.js'

// JWT (decode-only, unsafe)
export {
  decodeJwtPayload,
  getJwtStringProperty,
  type JwtPayload
} from './jwt.js'

// Encoding helpers (re-exported because crypto callers often need them too)
export {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64UrlEncode,
  base64UrlDecode,
  hexEncode,
  hexDecode
} from './internal/encoding.js'
