# aes-gcm

AES-256-GCM authenticated encryption for short-lived secrets (session cookies, OIDC state, anything where the storage format is opaque to consumers).

```ts
import {
  deriveAesGcmKey,
  encryptAesGcm,
  decryptAesGcm
} from '@linagora/twake-crypto-utils'
```

Each call uses a fresh random 96-bit IV. Tampering with any byte (IV, ciphertext, or auth tag) makes decryption return `null`.

## `deriveAesGcmKey(secret)`

Derive a `CryptoKey` from a string secret via SHA-256.

```ts
const key = await deriveAesGcmKey(process.env.SESSION_SECRET!)
```

Call **once at startup** and reuse the returned key across every `encrypt`/`decrypt` call - `CryptoKey` is an opaque handle that doesn't need re-importing.

| Param    | Type     | Notes                           |
| -------- | -------- | ------------------------------- |
| `secret` | `string` | Must be at least 32 characters. |

**Throws** if `secret` is shorter than 32 characters.

## `encryptAesGcm(plaintext, key)`

```ts
const token = await encryptAesGcm('hello', key)
// token: base64url string of `iv || ciphertext+tag`
```

| Param       | Type        | Notes                        |
| ----------- | ----------- | ---------------------------- |
| `plaintext` | `string`    | UTF-8 encoded. May be empty. |
| `key`       | `CryptoKey` | From `deriveAesGcmKey`.      |

## `decryptAesGcm(token, key)`

```ts
const plaintext = await decryptAesGcm(token, key)
// plaintext: string | null
```

Returns `null` on any failure - malformed payload, wrong key, tampered ciphertext. Errors are swallowed so callers can branch on `null` instead of wrapping every call in try/catch.

## Example: signed session cookie

```ts
import { deriveAesGcmKey, encryptAesGcm, decryptAesGcm } from '@linagora/twake-crypto-utils';

const key = await deriveAesGcmKey(process.env.SESSION_SECRET!);

// Issue
const cookie = await encryptAesGcm(
  JSON.stringify({ sub: 'user-1', exp: Date.now() + 8 * 3600 * 1000 }),
  key
);

// Verify
const json = await decryptAesGcm(cookie, key);
if (!json) return null;
const session = JSON.parse(json);
if (session.exp < Date.now()) return null;
```

## Caveats

- **Reuse the IV-key pair only across distinct ciphertexts.** This helper generates a fresh IV per call, so as long as you don't manually construct payloads or reuse a fixed IV, you're safe.
- **Don't use this format for cross-system interop.** It's an opaque internal format. For wire-format AES-GCM with AAD or a specific layout, use Web Crypto's `subtle` directly.
- The library does **not** sign or expire the payload - that's your job (embed `exp` in the JSON, check it after decrypt).

## See also

- [sha256](./sha256.md) - `deriveAesGcmKey` is conceptually `SHA-256(secret)` + key import.
