# API Reference

Isomorphic cryptography helpers for Twake services.

- **`@linagora/twake-crypto-utils`** - the main entry. Works in any runtime with the standard Web Crypto API (Node 24+, Bun, Deno, modern browsers). Web Crypto-backed helpers are `async`; pure-JS helpers (random tokens, constant-time string compare, encoding, password regex) are `sync`.
- **`@linagora/twake-crypto-utils/node`** - the scrypt suite. Pulled into a separate subpath because scrypt has no Web Crypto primitive and would force a `node:crypto` import into browser bundles.

## Pages

| Module                              | Entry     | What it does                                               |
| ----------------------------------- | --------- | ---------------------------------------------------------- |
| [pbkdf2](./pbkdf2.md)               | main      | Client-side two-stage password derivation.                 |
| [hkdf](./hkdf.md)                   | main      | HKDF-Expand for deriving subkeys from a master key.        |
| [aes-cbc](./aes-cbc.md)             | main      | Bitwarden-compatible AES-CBC key wrapping (v0 + v2).       |
| [aes-gcm](./aes-gcm.md)             | main      | Short-lived session encryption with `CryptoKey`.           |
| [rsa](./rsa.md)                     | main      | RSA-OAEP 2048 keypair generation + private-key unwrapping. |
| [hmac](./hmac.md)                   | main      | HMAC-SHA256 hex digest + constant-time verification.       |
| [sha256](./sha256.md)               | main      | SHA-256 hashing + constant-time string compare.            |
| [random](./random.md)               | main      | Random tokens and strings (unbiased rejection sampling).   |
| [password](./password.md)           | main      | Complexity-rule validation.                                |
| [jwt](./jwt.md)                     | main      | JWT payload decode (no signature verification).            |
| [encoding](./encoding.md)           | main      | base64, base64url, hex, shared UTF-8 encoder/decoder.      |
| [scrypt](./scrypt.md)               | `/node`   | Scrypt password hashing (Node-only).                       |
| [Cipher format](./cipher-format.md) | reference | The Bitwarden-style `v.iv\|cipher[\|mac]` string.          |

## Runtime requirements

- Node **24+**, Bun, Deno (with node compat for the `/node` subpath), or any browser with the standard Web Crypto API on `globalThis.crypto`.
- The package has no third-party runtime dependencies.

## Convention notes

- Anywhere this package returns a base64 string it's **standard base64** (with `+`/`/` and `=` padding). Anywhere it returns base64url it says so. Hex outputs are lowercase.
- Functions that take a "secret" or "key" string accept any UTF-8 string; the helper handles the encoding.
- Async helpers throw at the boundary if the runtime lacks Web Crypto. They never silently return `null` on missing-runtime - only on explicitly documented failure modes (e.g. PBKDF2 derivation failure, AES-GCM decryption failure, JWT decode failure).
