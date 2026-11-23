# hkdf

HKDF-Expand (RFC 5869) using HMAC-SHA256. Isomorphic.

```ts
import { hkdfExpand } from '@linagora/twake-crypto-utils'
```

## When to use

Given a uniformly-random pseudorandom key (`prk`) - the output of HKDF-Extract, a previously derived key, or a CSPRNG seed - derive multiple distinct subkeys bound to a context string. Each subkey is independent of the others as long as the `info` strings differ.

This package uses it internally to split a 32-byte master key into independent encryption + MAC keys (`info = 'enc'` and `info = 'mac'`).

## `hkdfExpand(prk, info, length)`

```ts
const okm = await hkdfExpand(prk, info, length)
// okm: ArrayBuffer of `length` bytes
```

| Param    | Type                        | Notes                                                             |
| -------- | --------------------------- | ----------------------------------------------------------------- |
| `prk`    | `ArrayBuffer \| Uint8Array` | Pseudorandom key. Must already be uniform.                        |
| `info`   | `Uint8Array`                | Context binding. Use a different `info` per subkey. May be empty. |
| `length` | `number`                    | Output length in bytes. Must be `<= 255 * 32 = 8160`.             |

**Throws** if `length > 8160` (HKDF's hard upper bound for SHA-256).

## Examples

```ts
const enc = new TextEncoder();
const masterKey = ...; // 32-byte CSPRNG output

const encryptionKey = await hkdfExpand(masterKey, enc.encode('enc'), 32);
const macKey        = await hkdfExpand(masterKey, enc.encode('mac'), 32);
const headerKey     = await hkdfExpand(masterKey, enc.encode('hdr'), 16);
```

## Caveats

- This is **HKDF-Expand only**, not the full Extract-and-Expand. If your input is non-uniform (e.g. raw user input, ECDH shared secret), run HKDF-Extract first or use Web Crypto's combined `subtle.deriveBits({name:'HKDF', ...})` API.
- Don't reuse the same `info` for different purposes - that defeats domain separation.

## See also

- [aes-cbc](./aes-cbc.md) - version-2 cipher path uses this internally.
