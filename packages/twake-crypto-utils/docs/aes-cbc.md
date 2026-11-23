# aes-cbc

Bitwarden-compatible AES-CBC key wrapping. Isomorphic.

```ts
import {
  CIPHER_VERSION_AES_CBC,
  CIPHER_VERSION_AES_CBC_HMAC,
  makeEncryptionKey,
  encryptEncryptionKey,
  decryptEncryptionKey
} from '@linagora/twake-crypto-utils'
```

See [cipher-format](./cipher-format.md) for the wire format reference.

## `makeEncryptionKey(masterKey)`

Generate a fresh 64-byte symmetric key and wrap it under `masterKey` using AES-CBC.

```ts
const { cipherString, key } = await makeEncryptionKey(masterKey)
// cipherString: "0.{iv}|{cipher}"
// key: Uint8Array of 64 bytes - [0..32) AES enc key, [32..64) HMAC MAC key
```

| Param       | Type          | Notes                                          |
| ----------- | ------------- | ---------------------------------------------- |
| `masterKey` | `ArrayBuffer` | The AES-CBC wrapping key. 16, 24, or 32 bytes. |

**Throws** if `masterKey` is not a valid AES-CBC length.

## `encryptEncryptionKey(key, masterKey)`

Wrap an existing key under a new master key. Used during password changes.

```ts
const cipherString = await encryptEncryptionKey(oldKeyBytes, newMasterKey)
// → "0.{iv}|{cipher}"
```

## `decryptEncryptionKey(cipherString, masterKey)`

Decrypt either a version-0 or version-2 cipher string.

- **Version 0** (`0.{iv}|{cipher}`): direct AES-CBC under `masterKey`.
- **Version 2** (`2.{iv}|{cipher}|{mac}`): stretches `masterKey` via HKDF-Expand into independent enc + MAC keys, verifies the HMAC-SHA256 tag over `iv || cipher`, then decrypts. Fails closed with `MAC verification failed` if anything has been tampered with.

```ts
const plaintext = await decryptEncryptionKey(cipherString, masterKey)
// plaintext: ArrayBuffer
```

**Throws** on malformed cipher strings, unsupported version prefixes, or (v2 only) MAC verification failure.

## Constants

| Constant                      | Value |
| ----------------------------- | ----- |
| `CIPHER_VERSION_AES_CBC`      | `'0'` |
| `CIPHER_VERSION_AES_CBC_HMAC` | `'2'` |

## Caveats

- `makeEncryptionKey` and `encryptEncryptionKey` only emit **version-0** cipher strings. The v2 decrypt path uses HKDF-Expand to stretch the master key into independent enc + MAC keys; no public helper currently emits v2 strings for this scheme.
- `generateKeyPair` (see [rsa](./rsa.md)) also emits v2 strings, but with a **different** key derivation - it splits a 64-byte symmetric key directly instead of stretching a 32-byte master via HKDF. The two are not interoperable: use `decryptKeyPairPrivateKey` for those, `decryptEncryptionKey` for everything else.
- AES-CBC alone is malleable; the version-2 format adds an HMAC for integrity. Use version 2 for new ciphertexts that need authentication.

## See also

- [rsa](./rsa.md) - produces version-2 cipher strings using raw split keys (not HKDF).
- [aes-gcm](./aes-gcm.md) - preferred for short-lived authenticated encryption that doesn't need this storage format.
- [cipher-format](./cipher-format.md) - wire format details.
