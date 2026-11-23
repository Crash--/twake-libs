# rsa

RSA-OAEP 2048-bit keypair generation with AES-CBC + HMAC-SHA256 wrapping of the private key.

```ts
import {
  generateKeyPair,
  decryptKeyPairPrivateKey
} from '@linagora/twake-crypto-utils'
```

## `generateKeyPair(symmetricKey)`

Generate a 2048-bit RSA-OAEP keypair and wrap the private key under a 64-byte symmetric key.

```ts
const { publicKey, privateKey } = await generateKeyPair(symmetricKey)
// publicKey: base64 SPKI
// privateKey: "2.{iv}|{cipher}|{mac}" wrapping the PKCS8 private key
```

| Param          | Type         | Notes                                                                           |
| -------------- | ------------ | ------------------------------------------------------------------------------- |
| `symmetricKey` | `Uint8Array` | Exactly 64 bytes: [0..32) AES-CBC encryption key, [32..64) HMAC-SHA256 MAC key. |

## `decryptKeyPairPrivateKey(cipherString, symmetricKey)`

Inverse of `generateKeyPair` for the private key. Verifies the MAC, then decrypts.

```ts
const pkcs8 = await decryptKeyPairPrivateKey(privateKeyCipher, symmetricKey)
// pkcs8: ArrayBuffer containing the raw PKCS8 private key
```

**Throws** on malformed cipher string, wrong version, wrong key length, or MAC verification failure.

## Cipher format vs. AES-CBC version 2

`generateKeyPair` writes a **version-2** cipher string (`2.{iv}|{cipher}|{mac}`) but derives the enc + MAC keys by **direct split** of the 64-byte symmetric key. The [aes-cbc](./aes-cbc.md) v2 decrypt path, in contrast, expects a 32-byte master and derives enc/MAC via HKDF-Expand. The two share a format prefix but are **not interoperable**: use `decryptKeyPairPrivateKey` to decrypt keypair private keys, and `decryptEncryptionKey` for everything else.

## Security caveats

- **OAEP uses SHA-1** as the mask-generation hash. SHA-1 is deprecated for new RSA-OAEP uses (NIST SP 800-131A); it's kept here only to remain interoperable with existing ciphertexts. **Do not change** this hash without a coordinated migration of all stored private keys.
- RSA-2048 generation takes ~50-500ms depending on runtime. Generate once per account; never on a hot path.

## See also

- [aes-cbc](./aes-cbc.md) - version-2 cipher format details (note key derivation difference).
- [cipher-format](./cipher-format.md) - wire format reference.
