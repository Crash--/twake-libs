# @linagora/twake-crypto-utils

Cryptography helpers built on the Web Crypto API. Runs in Node, Bun, Deno, and browsers without polyfills or third-party dependencies.

## Install

```bash
npm install @linagora/twake-crypto-utils
```

Requires Node 24+ or any runtime that exposes `globalThis.crypto.subtle`.

## Quick start

```typescript
import { hmacSha256, verifyHmacSha256 } from '@linagora/twake-crypto-utils'

const digest = await hmacSha256(payload, process.env.SECRET!)
const ok = await verifyHmacSha256(payload, process.env.SECRET!, digest)
```

```typescript
import {
  deriveAesGcmKey,
  encryptAesGcm,
  decryptAesGcm
} from '@linagora/twake-crypto-utils'

const key = await deriveAesGcmKey(process.env.SESSION_SECRET!) // once at startup
const cookie = await encryptAesGcm(JSON.stringify(session), key)
const json = await decryptAesGcm(cookie, key) // null on tamper
```

Full API reference: [`docs/`](./docs/README.md).

## What's available

| Capability           | Helpers                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Password hashing     | `pbkdf2Hash`; `generateScryptHash` (via `/node`)                                                                 |
| Symmetric encryption | `makeEncryptionKey`, `decryptEncryptionKey` (AES-CBC, Bitwarden cipher format), `encryptAesGcm`, `decryptAesGcm` |
| Asymmetric           | `generateKeyPair`, `decryptKeyPairPrivateKey` (RSA-OAEP 2048)                                                    |
| MAC + hash           | `hmacSha256`, `verifyHmacSha256`, `createSha256Hash`, `hkdfExpand`, `timingSafeStringEqual`                      |
| Random               | `generateRandomToken`, `generateRandomString`                                                                    |
| JWT                  | `decodeJwtPayload`, `getJwtStringProperty` (decode-only)                                                         |
| Encoding             | `arrayBufferToBase64`, `base64UrlEncode`, `hexEncode`, ...                                                       |

Web Crypto-backed helpers are `async`. Random, encoding, password regex, and `timingSafeStringEqual` are `sync`.

## Two entries

- `@linagora/twake-crypto-utils` runs anywhere with the Web Crypto API.
- `@linagora/twake-crypto-utils/node` carries `scrypt` only (no Web Crypto equivalent exists). Importing from browser code fails at build time, by design.

## License

MIT
