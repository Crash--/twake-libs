/**
 * Parsed scrypt parameters extracted from a marshaled hash string.
 */
export interface ScryptParameters {
  n: number
  r: number
  p: number
  salt: Uint8Array
  dkLen: number
}

/**
 * Full scrypt hash: parameters plus the derived key bytes.
 */
export interface ScryptHash extends ScryptParameters {
  dk: Uint8Array
}

/**
 * Result of a PBKDF2 password hash.
 *
 * - `hashed`: base64-encoded derived password bytes (safe to compare/store).
 * - `masterKey`: raw master key bytes used downstream for encryption-key derivation.
 */
export interface PBKDF2HashedPassword {
  hashed: string
  masterKey: ArrayBuffer
}

/**
 * Web Crypto PBKDF2 algorithm parameters.
 */
export interface PBKDF2Config {
  name: 'PBKDF2'
  hash: 'SHA-256'
  salt: Uint8Array
  iterations: number
}

/**
 * RSA keypair wrapped for storage:
 * - `publicKey`: base64-encoded SPKI public key.
 * - `privateKey`: Bitwarden-style cipher string `2.{iv}|{cipher}|{mac}` containing
 *   the AES-CBC + HMAC-SHA256 encrypted PKCS8 private key.
 */
export interface KeyPair {
  publicKey: string
  privateKey: string
}

/**
 * Encryption key wrapped under a master key.
 *
 * - `cipherString`: Bitwarden-style `0.{iv}|{cipher}` AES-CBC ciphertext.
 * - `key`: the raw 64-byte encryption key (first 32 bytes are the enc key,
 *   last 32 bytes are the MAC key).
 */
export interface EncryptionKey {
  cipherString: string
  key: Uint8Array
}
