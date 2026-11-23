# pbkdf2

Isomorphic client-side PBKDF2 password derivation.

```ts
import { pbkdf2Hash } from '@linagora/twake-crypto-utils'
```

## Why two stages

The helper runs PBKDF2-HMAC-SHA256 twice:

1. **Stage 1** derives a 256-bit master key from `password` + `salt` over `iterations` rounds. This key never leaves the client; downstream code uses it as the wrapping key for the user's encryption key.
2. **Stage 2** derives the stored password hash from that master key with **one** PBKDF2 round using `password` as the salt. This is the value sent to the server.

The split lets the server verify the password without ever seeing the master key.

## `pbkdf2Hash(password, salt, iterations)`

```ts
const result = await pbkdf2Hash(password, salt, iterations)
// result: { hashed: string; masterKey: ArrayBuffer } | null
```

| Param        | Type     | Notes                                                                 |
| ------------ | -------- | --------------------------------------------------------------------- |
| `password`   | `string` | UTF-8 encoded before hashing.                                         |
| `salt`       | `string` | Per-account, typically a domain-scoped string. UTF-8 encoded.         |
| `iterations` | `number` | Stage-1 iteration count. OWASP recommends **>= 600,000** for SHA-256. |

**Returns:**

- `hashed`: base64 of the stage-2 output (32 bytes → 44 base64 chars).
- `masterKey`: raw stage-1 bytes (32 bytes, `ArrayBuffer`).
- `null` on any failure from Web Crypto. Failure is returned (not thrown) so callers can fall through to generic auth error paths without wrapping every call in try/catch.

## Example

```ts
const result = await pbkdf2Hash('hunter2', 'salt@example.com', 600_000)
if (!result) throw new Error('hash failed')

// Send `result.hashed` to the server for password verification.
// Keep `result.masterKey` in memory; feed it to makeEncryptionKey() etc.
```

## See also

- [aes-cbc](./aes-cbc.md) - wraps the per-user encryption key under the master key returned here.
- [scrypt](./scrypt.md) - server-side hash of the `hashed` value before storage.
