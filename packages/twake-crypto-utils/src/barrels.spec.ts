import { describe, expect, it } from 'vitest'

import * as iso from './index.js'
import * as node from './node.js'

const ISO_EXPORTS = [
  'pbkdf2Hash',
  'hkdfExpand',
  'CIPHER_VERSION_AES_CBC',
  'CIPHER_VERSION_AES_CBC_HMAC',
  'makeEncryptionKey',
  'encryptEncryptionKey',
  'decryptEncryptionKey',
  'deriveAesGcmKey',
  'encryptAesGcm',
  'decryptAesGcm',
  'generateKeyPair',
  'decryptKeyPairPrivateKey',
  'hmacSha256',
  'verifyHmacSha256',
  'createSha256Hash',
  'timingSafeStringEqual',
  'generateRandomToken',
  'generateRandomString',
  'validatePasswordComplexity',
  'validateCnilPasswordComplexity',
  'decodeJwtPayload',
  'getJwtStringProperty',
  'arrayBufferToBase64',
  'base64ToArrayBuffer',
  'base64UrlEncode',
  'base64UrlDecode',
  'hexEncode',
  'hexDecode'
]

const NODE_ONLY_EXPORTS = [
  'generateScryptHash',
  'marshalScryptText',
  'unmarshalScryptText',
  'extractScryptParameters'
]

describe('isomorphic barrel (src/index.ts)', () => {
  it.each(ISO_EXPORTS)('exposes %s', name => {
    expect((iso as Record<string, unknown>)[name]).toBeDefined()
  })

  it.each(NODE_ONLY_EXPORTS)('does NOT expose Node-only export %s', name => {
    expect((iso as Record<string, unknown>)[name]).toBeUndefined()
  })
})

describe('node barrel (src/node.ts)', () => {
  it.each(NODE_ONLY_EXPORTS)('exposes %s', name => {
    expect((node as Record<string, unknown>)[name]).toBeDefined()
  })

  it('produces a parseable scrypt hash through the barrel', () => {
    const salt = new Uint8Array(16).fill(7)
    const hash = node.generateScryptHash('pw', salt, 1024, 8, 1, 32)
    const parsed = node.unmarshalScryptText(hash)
    expect(parsed.n).toBe(1024)
    expect(parsed.dk.length).toBe(32)
  })
})
