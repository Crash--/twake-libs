# scrypt

Scrypt password hashing. **Node-only** - exported from the `/node` subpath because Web Crypto has no scrypt primitive.

```ts
import {
  generateScryptHash,
  marshalScryptText,
  unmarshalScryptText,
  extractScryptParameters
} from '@linagora/twake-crypto-utils/node'
```

Synchronous and backed by Node's native `scryptSync`. Importing this subpath from browser-bundled code will fail at build time, which is the intended behavior.

## Storage format

Hashes serialize to a `$`-delimited string:

```
scrypt$N$r$p$saltHex$dkHex
```

Compact and self-describing - the parameters travel with the hash so verification doesn't need to remember them.

## `generateScryptHash(password, salt, n, r, p, length)`

```ts
const text = generateScryptHash(password, salt, 16384, 8, 1, 32)
// → 'scrypt$16384$8$1$<saltHex>$<dkHex>'
```

| Param      | Type         | Notes                                                       |
| ---------- | ------------ | ----------------------------------------------------------- |
| `password` | `string`     | UTF-8 encoded.                                              |
| `salt`     | `Uint8Array` | Per-password salt. 16 bytes is the conventional minimum.    |
| `n`        | `number`     | CPU/memory cost. **Must be a power of two greater than 1.** |
| `r`        | `number`     | Block size.                                                 |
| `p`        | `number`     | Parallelization.                                            |
| `length`   | `number`     | Output key length in bytes.                                 |

`maxmem` is fixed at 64 MiB; the call throws if N/r/p collectively exceed that budget.

## `marshalScryptText(n, r, p, salt, dk)`

Build the storage string from parameters and a precomputed derived key. Inverse of `unmarshalScryptText`.

## `unmarshalScryptText(input)`

Parse a marshaled scrypt string back into its parameters and key.

**Throws** if the prefix is not `scrypt`, the field count is wrong, or `n`/`r`/`p` are not integers.

## `extractScryptParameters(base64ScryptHash)`

Convenience wrapper for the common storage shape where the marshaled scrypt string is base64-encoded for transport. Equivalent to `unmarshalScryptText(atob(base64))`.

## Examples

```ts
import {
  generateScryptHash,
  unmarshalScryptText
} from '@linagora/twake-crypto-utils/node'
import { randomBytes } from 'node:crypto'

// Sign-up
const signupSalt = new Uint8Array(randomBytes(16))
const stored = generateScryptHash(password, signupSalt, 16384, 8, 1, 32)

// Verification
const parsed = unmarshalScryptText(storedRecord)
const recomputed = generateScryptHash(
  password,
  parsed.salt,
  parsed.n,
  parsed.r,
  parsed.p,
  parsed.dkLen
)
const ok = recomputed === storedRecord
```

For constant-time comparison of the marshaled string, use `timingSafeStringEqual` from the main barrel.

## When to pick scrypt vs PBKDF2 vs Argon2

- **PBKDF2** (this package, [pbkdf2](./pbkdf2.md)): client-side derivation of an encryption key. Good if you need an isomorphic helper.
- **scrypt** (here): server-side password hash for storage. Memory-hard, resists GPU attacks better than PBKDF2.
- **Argon2id**: would be preferred for new server-side password hashing. Not in this package because it requires a native binary dependency and no consumer asked for it.

## See also

- [pbkdf2](./pbkdf2.md) - the client-side counterpart in many flows.
- [sha256](./sha256.md) - `timingSafeStringEqual` for safe verification comparison.
