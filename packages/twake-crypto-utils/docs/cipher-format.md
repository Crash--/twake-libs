# Cipher string format

`makeEncryptionKey`, `encryptEncryptionKey`, and `generateKeyPair` all produce Bitwarden-compatible cipher strings. This page documents the wire format so callers can interop with stored ciphertexts produced elsewhere.

## Layout

```
<version>.<base64(iv)>|<base64(ciphertext)>[|<base64(mac)>]
```

The `.` separates the version prefix from the body. The body's segments are separated by `|`. All binary segments are **standard base64** with `+`/`/` and `=` padding (not base64url).

## Version 0 - `AesCbc256_B64`

```
0.{iv}|{cipher}
```

- AES-256-CBC encryption of `cipher` under a 32-byte key (or AES-128-CBC under 16, AES-192-CBC under 24).
- `iv` is 16 random bytes per encryption.
- **No MAC.** Ciphertext is malleable - any modification will decrypt to garbage but won't be detected.

Use only when integrity is enforced elsewhere (e.g. the ciphertext is itself an integrity-checked envelope downstream).

## Version 2 - `AesCbc256_HmacSha256_B64`

```
2.{iv}|{cipher}|{mac}
```

- AES-256-CBC encryption of `cipher` under a 32-byte derived encryption key.
- HMAC-SHA256 tag (`mac`) computed over `iv || cipher` using a 32-byte derived MAC key.
- `iv` is 16 random bytes per encryption.

### Key derivation - two incompatible flavors

This is the footgun: two helpers in this package emit version-2 strings using **different** key derivation, and they're not interoperable.

| Source                                       | Master key | Derivation                                                                          | Decrypt with               |
| -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- | -------------------------- |
| `makeEncryptionKey` / `encryptEncryptionKey` | 32 bytes   | HKDF-Expand: `encKey = HKDF(master, 'enc', 32)`, `macKey = HKDF(master, 'mac', 32)` | `decryptEncryptionKey`     |
| `generateKeyPair`                            | 64 bytes   | Raw split: `encKey = sym[0..32)`, `macKey = sym[32..64)`                            | `decryptKeyPairPrivateKey` |

The two share the `2.` prefix because they share the on-wire layout. The decryption side reads the prefix and assumes one derivation scheme; mismatched key derivation produces a MAC verification failure.

**Rule of thumb:** if you produced the ciphertext with `generateKeyPair`, decrypt with `decryptKeyPairPrivateKey`. Otherwise, `decryptEncryptionKey` is the entry point.

## Failure modes

`decryptEncryptionKey` and `decryptKeyPairPrivateKey` both throw `MAC verification failed` if:

- the IV has been modified
- the ciphertext has been modified
- the MAC has been modified
- the wrong key was supplied

They throw `Invalid cipher string` on malformed layouts (wrong segment count, missing version prefix, etc.) and `Unsupported cipher string version` on unknown version prefixes.

## Related (not implemented here)

Bitwarden defines more versions (`1`, `3`, `4`, `5`, `6`) for AES-256-CTR, RSA-wrapped keys, etc. This package implements only versions 0 and 2 because no consumer needs the others.

## See also

- [aes-cbc](./aes-cbc.md)
- [rsa](./rsa.md)
