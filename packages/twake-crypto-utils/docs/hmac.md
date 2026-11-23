# hmac

HMAC-SHA256 hex digest and constant-time verification.

```ts
import { hmacSha256, verifyHmacSha256 } from '@linagora/twake-crypto-utils'
```

## `hmacSha256(input, secret)`

```ts
const digest = await hmacSha256('payload', 'secret')
// → 64-character lowercase hex string
```

| Param    | Type     | Notes          |
| -------- | -------- | -------------- |
| `input`  | `string` | UTF-8 encoded. |
| `secret` | `string` | UTF-8 encoded. |

## `verifyHmacSha256(input, secret, expected)`

Constant-time comparison of an HMAC-SHA256 hex digest.

```ts
const ok = await verifyHmacSha256(payload, secret, providedDigest)
```

The HMAC is **always computed** before comparison, so the verification's runtime doesn't depend on whether `expected` has the right length or shape. Comparison uses `timingSafeStringEqual` (see [sha256](./sha256.md)).

Returns `false` on any mismatch - wrong digest, wrong length, empty `expected`.

## Use cases

- **Opaque storage keys.** Derive a deterministic key from sensitive input so the plaintext doesn't have to live in storage:
  ```ts
  const rateLimitKey = await hmacSha256(emailAddress, process.env.SECRET!)
  ```
- **Incoming webhook signatures.** Verify provider-signed payloads:
  ```ts
  if (!(await verifyHmacSha256(rawBody, webhookSecret, req.headers['x-signature']))) {
    return res.status(401).end();
  }
  ```

## See also

- [sha256](./sha256.md) - `createSha256Hash` for plain hashing, `timingSafeStringEqual` for the comparison primitive.
