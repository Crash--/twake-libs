# encoding

Encoding helpers re-exported from the main barrel because crypto callers need them often.

```ts
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  base64UrlEncode,
  base64UrlDecode,
  hexEncode,
  hexDecode
} from '@linagora/twake-crypto-utils'
```

All helpers are synchronous and isomorphic.

## base64 (standard)

```ts
arrayBufferToBase64(bytes): string   // standard base64, with '+'/'/' and '=' padding
base64ToArrayBuffer(s): ArrayBuffer
```

Used for storage / interop with anything that expects classic base64. Backed by global `btoa`/`atob`.

## base64url (RFC 4648 §5)

```ts
base64UrlEncode(bytes): string   // '+' → '-', '/' → '_', no padding
base64UrlDecode(s): ArrayBuffer  // accepts input with or without padding
```

Used in JWT headers/payloads, URLs, cookies, anywhere `+`/`/`/`=` would need escaping.

`base64UrlDecode` throws if the input length mod 4 is 1 (impossible to be valid base64url).

## hex

```ts
hexEncode(bytes): string         // lowercase hex, 2 chars per byte
hexDecode(s): Uint8Array         // throws on odd length or non-hex chars
```

Used for HMAC digests, opaque tokens, and any output that humans might compare or paste into URLs.

## Examples

```ts
import {
  hexEncode,
  hexDecode,
  base64UrlEncode
} from '@linagora/twake-crypto-utils'

// Round-trip bytes through hex
const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
const hex = hexEncode(original) // 'deadbeef'
const back = hexDecode(hex) // Uint8Array<[0xde, 0xad, 0xbe, 0xef]>

// Encode bytes for a URL parameter
const param = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
```

## Note on `Buffer`

This package does not use Node's `Buffer` outside the `/node` scrypt helper. If you want a Node `Buffer` from one of these helpers' outputs, wrap explicitly:

```ts
const buf = Buffer.from(hexEncode(bytes), 'hex') // works in Node
```
