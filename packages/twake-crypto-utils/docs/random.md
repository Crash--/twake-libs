# random

Cryptographically secure random tokens and strings. Synchronous, isomorphic.

```ts
import {
  generateRandomToken,
  generateRandomString
} from '@linagora/twake-crypto-utils'
```

Both helpers use `globalThis.crypto.getRandomValues` under the hood - sync everywhere and never blocks.

## `generateRandomToken(bytes = 32)`

```ts
const token = generateRandomToken() // 64 hex chars (32 bytes)
const short = generateRandomToken(16) // 32 hex chars
```

Use for opaque server-side tokens: OAuth state/nonce, password-reset tokens, API keys, internal session identifiers - anything that's never displayed to a user.

## `generateRandomString(length, alphabet?)`

```ts
const code = generateRandomString(6) // 6-char [A-Za-z0-9]
const otp = generateRandomString(6, '0123456789') // 6-digit numeric
const slug = generateRandomString(8, 'abcdefghijkmnpqrstuvwxyz23456789') // human-readable
```

| Param      | Type      | Notes                                                                |
| ---------- | --------- | -------------------------------------------------------------------- |
| `length`   | `number`  | Output character count.                                              |
| `alphabet` | `string?` | Defaults to `[A-Za-z0-9]` (62 chars). Must contain 1-256 characters. |

Uses **unbiased rejection sampling** - bytes that would skew the distribution are discarded. Each character is uniformly distributed across the alphabet.

**Throws** if `alphabet` is empty or longer than 256 characters.

## Why two helpers

- `generateRandomToken` returns hex. Always 2 chars per byte, fits in URLs, easy to grep for. Use for tokens you store but never display.
- `generateRandomString` returns characters from any alphabet you choose. Use for codes a human will read or type.

Don't use `generateRandomString` to make hex tokens (`generateRandomToken` is faster and clearer).

## See also

- [encoding](./encoding.md) - `hexEncode` if you have bytes you want to hex-encode directly.
